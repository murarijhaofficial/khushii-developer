import {Express,Request,Response,RequestHandler} from 'express';
import {PrismaClient,Role} from '@prisma/client';
import {z} from 'zod';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {applyWhatsAppReceipts} from './whatsapp-receipts.js';
import {leadEditors,leadManagers,canAccessLead} from './permissions.js';
import {emailConfigured,whatsappConfigured,listWhatsAppTemplates,sendEmail,sendWhatsAppTemplate,DeliveryError} from './messaging.js';

type R=Request & {auth?:{sub:string;role:Role}};
const activityInput=z.object({kind:z.enum(['NOTE','CALL','MEETING']),body:z.string().trim().min(1).max(6000)}).strict();
const reminderInput=z.object({title:z.string().trim().min(2).max(300),dueAt:z.string().datetime({offset:true}),userId:z.string().uuid().optional(),emailNotify:z.boolean().default(false)}).strict();
const messageInput=z.discriminatedUnion('channel',[
 z.object({channel:z.literal('EMAIL'),requestId:z.string().uuid(),subject:z.string().trim().min(1).max(200).refine(v=>!/[\r\n]/.test(v)),body:z.string().trim().min(1).max(20000)}).strict(),
 z.object({channel:z.literal('WHATSAPP'),requestId:z.string().uuid(),templateId:z.string().min(1).max(100),parameters:z.array(z.string().min(1).max(1000)).max(20)}).strict()
]);
function wrap(handler:(req:R,res:Response)=>Promise<unknown>):RequestHandler{return(req,res,next)=>{void handler(req as R,res).catch(next)}}
export function registerLeadWorkspace(app:Express,db:PrismaClient,auth:RequestHandler,requireRole:(...roles:Role[])=>RequestHandler){
 const editable=requireRole(...leadEditors);
 async function visibleLead(req:R){if(!z.string().uuid().safeParse(req.params.id).success)return null;return db.lead.findFirst({where:{id:req.params.id,...(req.auth!.role===Role.SALES_EXECUTIVE?{assignedToId:req.auth!.sub}:{})},include:{project:{select:{name:true}},assignedTo:{select:{id:true,name:true}}}});}
 app.get('/api/v1/communication/status',auth,(_req,res)=>res.json({email:emailConfigured(),whatsapp:whatsappConfigured(),emailDescription:'Resend',whatsappDescription:'Official WhatsApp Cloud API'}));
 app.get('/api/v1/communication/templates',auth,editable,wrap(async(_req,res)=>{try{res.json(await listWhatsAppTemplates())}catch(e){if(e instanceof DeliveryError)return res.status(503).json({error:e.message});throw e}}));
 app.get('/api/v1/leads/:id/workspace',auth,wrap(async(req,res)=>{
  const lead=await visibleLead(req);if(!lead)return res.status(404).json({error:'Lead not found'});
  const [activities,reminders,messages,consent]=await Promise.all([
   db.leadActivity.findMany({where:{leadId:lead.id},orderBy:{createdAt:'desc'},take:100,include:{user:{select:{name:true}}}}),
   db.reminder.findMany({where:{leadId:lead.id},orderBy:{dueAt:'asc'},take:100,include:{user:{select:{id:true,name:true}}}}),
   db.outboundMessage.findMany({where:{leadId:lead.id},orderBy:{createdAt:'desc'},take:100,include:{user:{select:{name:true}}}}),
   db.leadConsent.findFirst({where:{leadId:lead.id},orderBy:[{createdAt:'desc'},{optedIn:'asc'},{id:'desc'}]})]);
  res.json({lead,activities,reminders,messages,consent});
 }));
 app.post('/api/v1/leads/:id/activities',auth,editable,wrap(async(req,res)=>{const lead=await visibleLead(req);if(!lead)return res.status(404).json({error:'Lead not found'});const input=activityInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Enter a note or call/meeting outcome, up to 6000 characters.'});res.status(201).json(await db.leadActivity.create({data:{...input.data,leadId:lead.id,userId:req.auth!.sub}}));}));
 app.post('/api/v1/leads/:id/consent',auth,editable,wrap(async(req,res)=>{
  const lead=await visibleLead(req);if(!lead)return res.status(404).json({error:'Lead not found'});
  const input=z.object({optedIn:z.boolean(),evidence:z.string().trim().min(8).max(1000)}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:'Record how and when explicit WhatsApp opt-in or opt-out was obtained.'});
  const consent=await db.$transaction(async tx=>{const saved=await tx.leadConsent.create({data:{...input.data,leadId:lead.id,userId:req.auth!.sub}});await tx.leadActivity.create({data:{leadId:lead.id,userId:req.auth!.sub,kind:'CONSENT',body:`WhatsApp ${input.data.optedIn?'opt-in':'opt-out'} recorded: ${input.data.evidence}`}});return saved});res.status(201).json(consent);
 }));
 app.post('/api/v1/leads/:id/reminders',auth,editable,wrap(async(req,res)=>{
  const lead=await visibleLead(req);if(!lead)return res.status(404).json({error:'Lead not found'});const input=reminderInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Enter a reminder title and valid due date.'});
  const dueAt=new Date(input.data.dueAt);if(dueAt.getTime()<=Date.now())return res.status(400).json({error:'Choose a future date and time.'});
  const userId=input.data.userId||req.auth!.sub;if(userId!==req.auth!.sub&&!leadManagers.includes(req.auth!.role))return res.status(403).json({error:'Only managers can assign another user a reminder.'});
  const user=await db.user.findUnique({where:{id:userId}});if(!user||!leadEditors.includes(user.role)||!canAccessLead(user.role,user.id,lead.assignedToId))return res.status(400).json({error:'Choose a sales user who can access this lead.'});
  if(input.data.emailNotify&&!emailConfigured())return res.status(503).json({error:'Configure Resend before enabling reminder emails.'});
  const reminder=await db.$transaction(async tx=>{const saved=await tx.reminder.create({data:{title:input.data.title,dueAt,emailNotify:input.data.emailNotify,userId,leadId:lead.id}});await tx.leadActivity.create({data:{leadId:lead.id,userId:req.auth!.sub,kind:'FOLLOW_UP',body:`Follow-up scheduled for ${user.name}: ${input.data.title} (${dueAt.toISOString()})`}});return saved});res.status(201).json(reminder);
 }));
 app.get('/api/v1/reminders',auth,wrap(async(req,res)=>{
  const where={userId:req.auth!.sub,completedAt:null,...(req.auth!.role===Role.SALES_EXECUTIVE?{lead:{assignedToId:req.auth!.sub}}:{})};
  const [items,dueCount]=await Promise.all([db.reminder.findMany({where,orderBy:{dueAt:'asc'},take:100,include:{lead:{select:{id:true,name:true,phone:true}}}}),db.reminder.count({where:{...where,dueAt:{lte:new Date()}}})]);res.json({items,dueCount});
 }));
 app.patch('/api/v1/leads/:id/reminders/:reminderId',auth,editable,wrap(async(req,res)=>{
  const lead=await visibleLead(req);if(!lead)return res.status(404).json({error:'Lead not found'});if(!z.string().uuid().safeParse(req.params.reminderId).success)return res.status(400).json({error:'Invalid reminder'});
  const reminder=await db.reminder.findFirst({where:{id:req.params.reminderId,leadId:lead.id}});if(!reminder)return res.status(404).json({error:'Reminder not found'});if(reminder.userId!==req.auth!.sub&&!leadManagers.includes(req.auth!.role))return res.status(403).json({error:'Forbidden'});
  await db.$transaction(async tx=>{const changed=await tx.reminder.updateMany({where:{id:reminder.id,completedAt:null},data:{completedAt:new Date()}});if(changed.count)await tx.leadActivity.create({data:{leadId:lead.id,userId:req.auth!.sub,kind:'FOLLOW_UP',body:`Follow-up completed: ${reminder.title}`}})});res.json({ok:true});
 }));
 app.post('/api/v1/leads/:id/messages',auth,editable,wrap(async(req,res)=>{
  const lead=await visibleLead(req);if(!lead)return res.status(404).json({error:'Lead not found'});const input=messageInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Invalid message. Complete every required field.'});
  const fingerprint=createHash('sha256').update(JSON.stringify(input.data)).digest('hex');const existing=await db.outboundMessage.findUnique({where:{requestId:input.data.requestId}});
  if(existing){if(existing.userId!==req.auth!.sub||existing.leadId!==lead.id||existing.fingerprint!==fingerprint)return res.status(409).json({error:'Request ID already used for another message.'});return res.json(existing);}
  let body:string,subject:string,recipient:string;let template:Awaited<ReturnType<typeof listWhatsAppTemplates>>[number]|undefined;
  if(input.data.channel==='EMAIL'){if(!emailConfigured())return res.status(503).json({error:'Configure RESEND_API_KEY and verified EMAIL_FROM on the API server.'});if(!lead.email)return res.status(400).json({error:'This lead has no email address.'});body=input.data.body;subject=input.data.subject;recipient=lead.email;}
  else {
   const consent=await db.leadConsent.findFirst({where:{leadId:lead.id},orderBy:[{createdAt:'desc'},{optedIn:'asc'},{id:'desc'}]});if(!consent?.optedIn)return res.status(403).json({error:'Explicit WhatsApp opt-in is required. Website enquiry consent is not marketing opt-in.'});
   const templateId=input.data.templateId;
   try{template=(await listWhatsAppTemplates()).find(t=>t.id===templateId)}catch(e){if(e instanceof DeliveryError)return res.status(503).json({error:e.message});throw e}
   if(!template?.supported||template.parameterCount!==input.data.parameters.length)return res.status(400).json({error:'Select an approved supported text template and provide all variables.'});
   body=template.body.replace(/\{\{(\d+)\}\}/g,(_all,index:string)=>(input.data as {parameters:string[]}).parameters[Number(index)-1]||'');subject=template.name;recipient=lead.phone;
  }
  let message;try{message=await db.outboundMessage.create({data:{requestId:input.data.requestId,fingerprint,leadId:lead.id,userId:req.auth!.sub,channel:input.data.channel,body,subject,recipient}})}catch(e){if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2002')return res.status(409).json({error:'This send is already being processed. Retry with the same request ID.'});throw e}
  if(input.data.channel==='WHATSAPP'){
   const latest=await db.leadConsent.findFirst({where:{leadId:lead.id},orderBy:[{createdAt:'desc'},{optedIn:'asc'},{id:'desc'}]});
   if(!latest?.optedIn){await db.outboundMessage.update({where:{id:message.id},data:{status:'FAILED',error:'WhatsApp permission was withdrawn before sending.'}});return res.status(403).json({error:'WhatsApp permission was withdrawn before sending.'});}
  }
  try{const providerId=input.data.channel==='EMAIL'?await sendEmail(recipient,subject,body,message.id):await sendWhatsAppTemplate(recipient,template!,input.data.parameters);await db.outboundMessage.update({where:{id:message.id},data:{providerId,status:'ACCEPTED'}});if(input.data.channel==='WHATSAPP')await applyWhatsAppReceipts(db,providerId);res.status(201).json(await db.outboundMessage.findUnique({where:{id:message.id}}));}
  catch(e){const uncertain=!(e instanceof DeliveryError)||e.uncertain;await db.outboundMessage.update({where:{id:message.id},data:{status:uncertain?'UNKNOWN':'FAILED',error:e instanceof DeliveryError?e.message:'Send status is unknown; do not resend automatically.'}});res.status(502).json({error:uncertain?'Delivery is unknown. Check the timeline/provider before sending again.':(e as Error).message,messageId:message.id});}
 }));
 // Meta status webhook: verify exact bytes before accepting events, then deduplicate in PostgreSQL.
 app.get('/api/v1/webhooks/whatsapp',(req,res)=>{const token=process.env.WHATSAPP_VERIFY_TOKEN;if(token&&req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===token)return res.type('text').send(String(req.query['hub.challenge']||''));res.sendStatus(403)});
 app.post('/api/v1/webhooks/whatsapp',wrap(async(req,res)=>{
  const secret=process.env.WHATSAPP_APP_SECRET;const raw=(req as Request & {rawBody?:Buffer}).rawBody;const provided=req.header('x-hub-signature-256')||'';
  if(!secret||!raw||!/^sha256=[a-f0-9]{64}$/.test(provided))return res.sendStatus(401);const expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex');if(!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return res.sendStatus(401);
  const payload=z.object({object:z.literal('whatsapp_business_account'),entry:z.array(z.object({changes:z.array(z.object({value:z.object({metadata:z.object({phone_number_id:z.string()}).optional(),statuses:z.array(z.object({id:z.string(),status:z.string(),timestamp:z.string()})).optional()})}))}))}).safeParse(req.body);if(!payload.success)return res.status(400).json({error:'Invalid webhook'});
  for(const entry of payload.data.entry)for(const change of entry.changes){if(change.value.metadata?.phone_number_id!==process.env.WHATSAPP_PHONE_NUMBER_ID)continue;for(const event of change.value.statuses||[]){
   if(!['sent','delivered','read','failed'].includes(event.status))continue;const key=createHash('sha256').update(`${event.id}:${event.status}:${event.timestamp}`).digest('hex');
   try{await db.webhookEvent.create({data:{provider:'whatsapp',externalId:key,payload:event}})}catch(e){if(!(typeof e==='object'&&e!==null&&'code'in e&&e.code==='P2002'))throw e}
   await applyWhatsAppReceipts(db,event.id);
  }}res.json({received:true});
 }));
}
