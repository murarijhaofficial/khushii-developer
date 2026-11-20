import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import { PrismaClient, Role, LeadStatus } from '@prisma/client';
import { z } from 'zod';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { canAccessLead, leadEditors, leadManagers } from './permissions.js';
import { parseCorsOrigins } from './cors-config.js';
import {registerLeadWorkspace} from './lead-workspace.js';
import {fetchNestoriaBatch,WebsiteSyncError} from './nestoria-sync.js';
import {phoneSchema,saveEnquiry} from './enquiries.js';
import {registerCampaigns,processCampaigns} from './campaigns.js';

const db = new PrismaClient();
const app = express();
const origin = process.env.CORS_ORIGIN;
const integrationSecret = process.env.WEBHOOK_SHARED_SECRET;
if (!integrationSecret || integrationSecret.length < 24 || !origin) throw new Error('Set strong WEBHOOK_SHARED_SECRET and CORS_ORIGIN');
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:parseCorsOrigins(origin),credentials:true}));
app.use(express.json({limit:'64kb',verify:(req,_res,buf)=>{(req as Request & {rawBody?:Buffer}).rawBody=Buffer.from(buf)}}));
app.use(express.urlencoded({extended:false,limit:'16kb'}));
app.use('/api/v1',rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:'draft-7',legacyHeaders:false}));
type Claims={sub:string;role:Role;email:string;sessionId:string;csrfToken:string};
type AuthRequest=Request & {auth?:Claims};
const production=process.env.NODE_ENV==='production';
const cookieOptions={httpOnly:true,secure:production,sameSite:production?'none' as const:'lax' as const,path:'/api/v1'};
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
function readSessionCookie(req:Request):string|undefined {
 const entries=(req.headers.cookie??'').split(';').map(part=>part.trim());
 const matches=entries.filter(part=>part.startsWith('crm_session='));
 return matches.length===1?matches[0].slice('crm_session='.length):undefined;
}
async function auth(req:AuthRequest,res:Response,next:NextFunction){
 const token=readSessionCookie(req);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return res.status(401).json({error:'Unauthorized'});
 try {
  const session=await db.session.findUnique({where:{tokenHash:hashToken(token)},include:{user:{select:{id:true,email:true,role:true,enabled:true}}}});
  if(!session||!session.user.enabled||session.expiresAt<=new Date())return res.status(401).json({error:'Unauthorized'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!secretMatches(req.header('x-csrf-token'),session.csrfToken))return res.status(403).json({error:'Invalid CSRF token'});
  req.auth={sub:session.user.id,email:session.user.email,role:session.user.role,sessionId:session.id,csrfToken:session.csrfToken};next();
 } catch(e){next(e)}
}
function requireRole(...roles:Role[]){return (req:AuthRequest,res:Response,next:NextFunction)=>roles.includes(req.auth!.role)?next():res.status(403).json({error:'Forbidden'})}
function secretMatches(a:string|undefined,b:string){if(!a)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
const loginSchema=z.object({email:z.string().email(),password:z.string().min(1)});
const leadSchema=z.object({name:z.string().min(2).max(120),phone:phoneSchema,email:z.string().email().optional().nullable(),source:z.string().max(50).default('manual'),status:z.nativeEnum(LeadStatus).optional(),message:z.string().max(6000).optional().nullable(),projectId:z.string().uuid().optional().nullable(),utmSource:z.string().max(100).optional(),utmCampaign:z.string().max(100).optional()});
app.get('/api/v1/health',(_req,res)=>res.json({status:'ok'}));
app.post('/api/v1/auth/login',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res,next)=>{
 try {
 const input=loginSchema.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Invalid credentials'});
 const user=await db.user.findUnique({where:{email:input.data.email.toLowerCase()}});
 if(!user||!user.enabled||!(await argon2.verify(user.passwordHash,input.data.password)))return res.status(401).json({error:'Invalid credentials'});
 const token=randomBytes(32).toString('hex');const csrfToken=randomBytes(32).toString('hex');
 const oldToken=readSessionCookie(req);
 const created=await db.$transaction(async(tx)=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;const current=await tx.user.findUnique({where:{id:user.id}});if(!current?.enabled||current.passwordHash!==user.passwordHash)return false;if(oldToken&&/^[a-f0-9]{64}$/.test(oldToken))await tx.session.deleteMany({where:{tokenHash:hashToken(oldToken)}});await tx.session.create({data:{tokenHash:hashToken(token),csrfToken,userId:user.id,expiresAt:new Date(Date.now()+8*60*60*1000)}});return true});if(!created)return res.status(401).json({error:'Invalid credentials'});
 res.cookie('crm_session',token,{...cookieOptions,maxAge:8*60*60*1000});
 res.json({csrfToken,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
 } catch(e){next(e)}
});
app.get('/api/v1/auth/me',auth,async(req:AuthRequest,res)=>{const user=await db.user.findUnique({where:{id:req.auth!.sub},select:{id:true,name:true,email:true,role:true}});if(!user)return res.status(401).json({error:'Unauthorized'});res.json({user,csrfToken:req.auth!.csrfToken})});
app.post('/api/v1/auth/logout',auth,async(req:AuthRequest,res,next)=>{try{await db.session.deleteMany({where:{id:req.auth!.sessionId}});res.clearCookie('crm_session',cookieOptions);res.json({ok:true})}catch(e){next(e)}});
app.get('/api/v1/users',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN,Role.SALES_MANAGER),async(_req,res)=>res.json(await db.user.findMany({select:{id:true,name:true,email:true,role:true,enabled:true,createdAt:true},orderBy:{name:'asc'}})));
app.post('/api/v1/users',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(req:AuthRequest,res)=>{
 const input=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254),password:z.string().min(12).max(128),role:z.nativeEnum(Role)}).safeParse(req.body);
 if(!input.success)return res.status(400).json({error:input.error.flatten()});
 if(input.data.role===Role.SUPER_ADMIN&&req.auth!.role!==Role.SUPER_ADMIN)return res.status(403).json({error:'Only a super admin can create a super admin'});
 const email=input.data.email.toLowerCase();if(await db.user.findUnique({where:{email}}))return res.status(409).json({error:'Email already in use'});
 try {const user=await db.user.create({data:{name:input.data.name,email,passwordHash:await argon2.hash(input.data.password),role:input.data.role},select:{id:true,name:true,email:true,role:true,createdAt:true}});res.status(201).json(user)} catch(e){if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2002')return res.status(409).json({error:'Email already in use'});throw e}
});
const passwordChangeLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/api/v1/auth/password',auth,passwordChangeLimiter,async(req:AuthRequest,res,next)=>{
 try{
  const input=z.object({currentPassword:z.string().min(1).max(128),newPassword:z.string().min(12).max(128)}).strict().safeParse(req.body);
  if(!input.success)return res.status(400).json({error:'Enter your current password and a new password of 12 to 128 characters.'});
  const user=await db.user.findUnique({where:{id:req.auth!.sub}});
  if(!user||!await argon2.verify(user.passwordHash,input.data.currentPassword))return res.status(403).json({error:'Current password is incorrect.'});
  const passwordHash=await argon2.hash(input.data.newPassword);
  const updated=await db.$transaction(async tx=>{
   const result=await tx.user.updateMany({where:{id:user.id,passwordHash:user.passwordHash,enabled:true},data:{passwordHash}});
   if(result.count)await tx.session.deleteMany({where:{userId:user.id,id:{not:req.auth!.sessionId}}});
   return result.count;
  });
  if(!updated)return res.status(409).json({error:'Account changed. Please sign in again.'});
  res.json({ok:true});
 }catch(e){next(e)}
});
app.patch('/api/v1/users/:id',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(req:AuthRequest,res,next)=>{
 try{
  const input=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254),role:z.nativeEnum(Role),enabled:z.boolean(),password:z.string().min(12).max(128).optional()}).strict().safeParse(req.body);
  if(!input.success)return res.status(400).json({error:'Check the account details and password length.'});
  if(req.params.id===req.auth!.sub)return res.status(403).json({error:'Use Change password for your own account. Another administrator must edit your access.'});
  const passwordHash=input.data.password?await argon2.hash(input.data.password):undefined;
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(87341298)`;
   const actor=await tx.user.findUnique({where:{id:req.auth!.sub}});
   const target=await tx.user.findUnique({where:{id:req.params.id}});
   if(!actor?.enabled||actor.role!==Role.ADMIN&&actor.role!==Role.SUPER_ADMIN)return 'forbidden';
   if(!target)return 'missing';
   if(actor.role!==Role.SUPER_ADMIN&&(target.role===Role.SUPER_ADMIN||input.data.role===Role.SUPER_ADMIN))return 'forbidden';
   if(target.role===Role.SUPER_ADMIN&&target.enabled&&(!input.data.enabled||input.data.role!==Role.SUPER_ADMIN)){
    if(await tx.user.count({where:{role:Role.SUPER_ADMIN,enabled:true}})<=1)return 'last-super-admin';
   }
   await tx.user.update({where:{id:target.id},data:{name:input.data.name,email:input.data.email.toLowerCase(),role:input.data.role,enabled:input.data.enabled,...(passwordHash?{passwordHash}:{})}});
   if(!input.data.enabled||passwordHash)await tx.session.deleteMany({where:{userId:target.id}});
   return 'ok';
  });
  if(result==='missing')return res.status(404).json({error:'Team member not found.'});
  if(result==='forbidden')return res.status(403).json({error:'You cannot manage this account.'});
  if(result==='last-super-admin')return res.status(409).json({error:'At least one active super administrator is required.'});
  res.json({ok:true});
 }catch(e){if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2002')return res.status(409).json({error:'Email already in use'});next(e)}
});
app.get('/api/v1/dashboard',auth,async(req:AuthRequest,res)=>{
 const where=req.auth!.role===Role.SALES_EXECUTIVE?{assignedToId:req.auth!.sub}:{};
 const [total,newLeads,qualified,booked]=await Promise.all([db.lead.count({where}),db.lead.count({where:{...where,status:'NEW'}}),db.lead.count({where:{...where,status:'QUALIFIED'}}),db.lead.count({where:{...where,status:'BOOKED'}})]);
 res.json({total,newLeads,qualified,booked});
});
app.get('/api/v1/leads',auth,async(req:AuthRequest,res)=>{
 const search=typeof req.query.search==='string'?req.query.search.slice(0,100):'';
 const status=typeof req.query.status==='string'&&Object.values(LeadStatus).includes(req.query.status as LeadStatus)?req.query.status as LeadStatus:undefined;
 const where={...(req.auth!.role===Role.SALES_EXECUTIVE?{assignedToId:req.auth!.sub}:{}),...(status?{status}:{}),...(search?{OR:[{name:{contains:search,mode:'insensitive' as const}},{phone:{contains:search}}]}:{})};
 const leads=await db.lead.findMany({where,orderBy:{createdAt:'desc'},include:{project:{select:{name:true}},assignedTo:{select:{id:true,name:true}},websiteForm:{select:{name:true}}}});res.json(leads);
});
app.post('/api/v1/leads',auth,requireRole(...leadEditors),async(req:AuthRequest,res)=>{
 const input=leadSchema.safeParse(req.body);if(!input.success)return res.status(400).json({error:input.error.flatten()});
 const result=await saveEnquiry(db,{...input.data,assignedToId:req.auth!.role===Role.SALES_EXECUTIVE?req.auth!.sub:null},lead=>canAccessLead(req.auth!.role,req.auth!.sub,lead.assignedToId));
 if(!result.lead)return res.status(409).json({error:'This phone number belongs to an existing lead. Contact a manager.'});
 res.status(result.created?201:200).json({...result.lead,enquiryAdded:!result.created});
});
app.patch('/api/v1/leads/:id',auth,requireRole(...leadEditors),async(req:AuthRequest,res)=>{
 const input=leadSchema.partial().safeParse(req.body);if(!input.success)return res.status(400).json({error:input.error.flatten()});
 const current=await db.lead.findUnique({where:{id:req.params.id}});if(!current)return res.status(404).json({error:'Not found'});
 if(!canAccessLead(req.auth!.role,req.auth!.sub,current.assignedToId))return res.status(403).json({error:'Forbidden'});
 if(input.data.phone&&input.data.phone!==current.phone)return res.status(400).json({error:'Changing a lead phone number is not supported; contact an administrator.'});
 const updated=await db.$transaction(async tx=>{const lead=await tx.lead.update({where:{id:current.id},data:input.data});if(input.data.status&&input.data.status!==current.status)await tx.leadActivity.create({data:{leadId:lead.id,userId:req.auth!.sub,kind:'STATUS_CHANGE',body:`Status changed from ${current.status} to ${input.data.status}`}});return lead});res.json(updated);
});
app.patch('/api/v1/leads/:id/assignment',auth,requireRole(...leadManagers),async(req:AuthRequest,res)=>{
 const input=z.object({assignedToId:z.string().uuid().nullable()}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:'Invalid assignment'});
 const lead=await db.lead.findUnique({where:{id:req.params.id}});if(!lead)return res.status(404).json({error:'Not found'});
 if(input.data.assignedToId){const user=await db.user.findUnique({where:{id:input.data.assignedToId}});if(!user||!leadEditors.includes(user.role))return res.status(400).json({error:'Select a sales user'});}
 res.json(await db.$transaction(async tx=>{const updated=await tx.lead.update({where:{id:lead.id},data:{assignedToId:input.data.assignedToId}});if(lead.assignedToId!==input.data.assignedToId)await tx.leadActivity.create({data:{leadId:lead.id,userId:req.auth!.sub,kind:'ASSIGNMENT',body:input.data.assignedToId?'Lead assignment updated.':'Lead moved to the unassigned inbox.'}});return updated}));
});
registerLeadWorkspace(app,db,auth,requireRole);
app.get('/api/v1/projects',auth,async(_req,res)=>res.json(await db.project.findMany({orderBy:{name:'asc'}})));
registerCampaigns(app,db,auth,requireRole);
app.get('/api/v1/integrations/website-status',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(_req,res,next)=>{try{const where={OR:[{externalId:{startsWith:'website:nestoria:'}},{externalId:{startsWith:'website:khep:'}}]};const [total,last]=await Promise.all([db.leadEnquiry.count({where}),db.leadEnquiry.findFirst({where,orderBy:{createdAt:'desc'},select:{createdAt:true}})]);res.json({total,lastReceivedAt:last?.createdAt??null,websiteUrl:process.env.WORDPRESS_SITE_URL||'https://khushiideveloper.com'})}catch(e){next(e)}});
app.post('/api/v1/integrations/nestoria/sync',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(req,res,next)=>{try{
 const input=z.object({after:z.number().int().min(0).max(999999999999).default(0)}).strict().safeParse(req.body);
 if(!input.success)return res.status(400).json({error:'Invalid sync cursor'});
 const batch=await fetchNestoriaBatch(process.env.WORDPRESS_SITE_URL||'https://khushiideveloper.com',input.data.after,integrationSecret!,process.env.NODE_ENV==='test');
 const slugs=[...new Set(batch.items.flatMap(item=>item.projectSlug?[item.projectSlug]:[]))];
 const projects=await db.project.findMany({where:{slug:{in:slugs}},select:{id:true,slug:true}});
 const projectIds=new Map(projects.map(p=>[p.slug,p.id]));
 let created=0,attached=0,replayed=0;for(const item of batch.items){const result=await saveEnquiry(db,{name:item.name,phone:item.phone,email:item.email,message:item.message,source:'website',externalId:'website:'+item.externalSubmissionId,projectId:item.projectSlug?projectIds.get(item.projectSlug):undefined});if(result.created)created++;else if(result.replayed)replayed++;else attached++;}
 res.json({created,attached,replayed,existing:attached+replayed,rejected:batch.rejected,nextAfter:batch.nextAfter,hasMore:batch.hasMore});
 }catch(e){if(e instanceof WebsiteSyncError)return res.status(502).json({error:e.message});next(e)}});
const websiteFormInput=z.object({name:z.string().trim().min(2).max(100),projectId:z.string().uuid().nullable().optional()}).strict();
app.get('/api/v1/website-forms',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(_req,res,next)=>{try{res.json(await db.websiteForm.findMany({orderBy:{createdAt:'desc'},include:{project:{select:{name:true}},_count:{select:{leads:true}}}}))}catch(e){next(e)}});
app.post('/api/v1/website-forms',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(req,res,next)=>{try{const input=websiteFormInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Please enter a valid form name and project'});if(input.data.projectId&&!await db.project.findUnique({where:{id:input.data.projectId}}))return res.status(400).json({error:'Project not found'});res.status(201).json(await db.websiteForm.create({data:input.data}))}catch(e){next(e)}});
app.patch('/api/v1/website-forms/:id',auth,requireRole(Role.SUPER_ADMIN,Role.ADMIN),async(req,res,next)=>{try{const input=z.object({enabled:z.boolean()}).strict().safeParse(req.body);if(!input.success||!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Invalid request'});const updated=await db.websiteForm.updateMany({where:{id:req.params.id},data:input.data});if(!updated.count)return res.status(404).json({error:'Form not found'});res.json({ok:true})}catch(e){next(e)}});
const publicFormLimit=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false});
function publicFormHeaders(res:Response){res.removeHeader('X-Frame-Options');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors *; base-uri 'none'");res.setHeader('Cache-Control','no-store');}
function htmlEscape(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}
app.get('/api/v1/public/forms/:id',publicFormLimit,async(req,res,next)=>{try{publicFormHeaders(res);if(!z.string().uuid().safeParse(req.params.id).success)return res.status(404).send('Form not found');const form=await db.websiteForm.findUnique({where:{id:req.params.id}});if(!form?.enabled)return res.status(404).send('Form not available');const id=htmlEscape(form.id),name=htmlEscape(form.name),submission=randomBytes(16).toString('hex');res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>body{font:16px system-ui,sans-serif;color:#26354a;margin:0;padding:16px}form{display:grid;gap:12px}label{display:grid;gap:5px}input,textarea,button{font:inherit;padding:10px;border:1px solid #ccd6df;border-radius:6px}button{background:#128968;color:white;border:0;cursor:pointer}.trap{position:absolute;left:-9999px}</style></head><body><h2>${name}</h2><form method="post" action="/api/v1/public/forms/${id}/submissions"><input type="hidden" name="submissionId" value="${submission}"><label>Name<input name="name" required minlength="2" maxlength="120" autocomplete="name"></label><label>Phone (Indian mobile or country code)<input name="phone" required placeholder="9876543210 or +919876543210" autocomplete="tel"></label><label>Email (optional)<input type="email" name="email" maxlength="254" autocomplete="email"></label><label>Message (optional)<textarea name="message" maxlength="3000"></textarea></label><label class="trap" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label><button type="submit">Send enquiry</button></form></body></html>`)}catch(e){next(e)}});
app.post('/api/v1/public/forms/:id/submissions',publicFormLimit,async(req,res,next)=>{try{publicFormHeaders(res);const input=z.object({submissionId:z.string().regex(/^[a-f0-9]{32}$/),name:z.string().trim().min(2).max(120),phone:phoneSchema,email:z.union([z.string().email().max(254),z.literal('')]).optional(),message:z.string().max(3000).optional(),website:z.string().max(0).optional()}).strict().safeParse(req.body);if(!z.string().uuid().safeParse(req.params.id).success||!input.success)return res.status(400).type('html').send('<p>Invalid submission. Please go back and check your details.</p>');const form=await db.websiteForm.findUnique({where:{id:req.params.id}});if(!form?.enabled)return res.status(404).send('Form not available');const data=input.data;await saveEnquiry(db,{name:data.name,phone:data.phone,email:data.email||null,message:data.message||null,source:'website',websiteFormId:form.id,projectId:form.projectId,externalId:`form:${form.id}:${data.submissionId}`});res.type('html').send('<p>Thank you. Your enquiry has been received.</p>')}catch(e){next(e)}});
async function ingestWebsiteLead(req:Request,res:Response,next:NextFunction){try{
 const input=leadSchema.extend({source:z.string().max(50).default('website'),externalSubmissionId:z.string().min(1).max(150),projectSlug:z.string().max(150).optional(),formType:z.string().max(100).optional(),consent:z.object({marketing:z.boolean().optional(),privacyAccepted:z.boolean().optional()}).optional()}).safeParse(req.body);
 if(!input.success)return res.status(400).json({error:input.error.flatten()});
 const {externalSubmissionId,projectSlug,formType,consent,...data}=input.data;
 const project=projectSlug?await db.project.findUnique({where:{slug:projectSlug}}):null;
 const result=await saveEnquiry(db,{...data,source:data.source||'website',externalId:`website:${externalSubmissionId}`,projectId:project?.id??data.projectId});
 res.status(202).json({id:result.lead!.id,accepted:true});
 }catch(e){next(e)}
}
app.post('/api/v1/integrations/website-leads',(req,res,next)=>{if(!secretMatches(req.header('x-integration-key'),integrationSecret!))return res.status(401).json({error:'Unauthorized'});next()},ingestWebsiteLead);
function verifyWebsiteSignature(req:Request,res:Response,next:NextFunction){
 const timestamp=req.header('x-crm-timestamp')||'';const signature=req.header('x-crm-signature')||'';const raw=(req as Request & {rawBody?:Buffer}).rawBody;
 if(!/^\d{10}$/.test(timestamp)||Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300||!raw||!/^sha256=[a-f0-9]{64}$/.test(signature))return res.status(401).json({error:'Invalid signature'});
 const expected='sha256='+createHmac('sha256',integrationSecret!).update(timestamp+'.').update(raw).digest('hex');if(!secretMatches(signature,expected))return res.status(401).json({error:'Invalid signature'});next();
}
app.post('/api/v1/integrations/signed-website-leads',verifyWebsiteSignature,ingestWebsiteLead);
app.post('/api/v1/integrations/website-connection',verifyWebsiteSignature,async(_req,res,next)=>{try{await db.$queryRaw`SELECT 1`;res.json({ready:true})}catch(e){next(e)}});
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{console.error('Request error',err);res.status(500).json({error:'Internal server error'})});
const port=Number(process.env.PORT||4000);
app.listen(port,'0.0.0.0',()=>console.log(`Khushii CRM API listening on ${port}`));
let campaignCycle=false;
setInterval(()=>{if(campaignCycle)return;campaignCycle=true;void processCampaigns(db).catch(()=>console.error('Campaign processing failed. Check the database and provider configuration.')).finally(()=>{campaignCycle=false})},5000).unref();
