import {Express,Request,RequestHandler,Response} from 'express';
import {PrismaClient,Role} from '@prisma/client';
import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {DeliveryError,listWhatsAppTemplates,sendWhatsAppTemplate,whatsappConfigured} from './messaging.js';
import {applyWhatsAppReceipts} from './whatsapp-receipts.js';
import {leadEditors} from './permissions.js';
import {templateDraftInput,templateParameterCount} from './template-drafts.js';

type R=Request & {auth?:{sub:string;role:Role}};
const roles=[Role.SUPER_ADMIN,Role.ADMIN,Role.MARKETING];
const draft=z.object({name:z.string().trim().min(3).max(120),templateId:z.string().min(1).max(100),parameters:z.array(z.string().trim().min(1).max(1000)).max(20),leadIds:z.array(z.string().uuid()).min(1).max(500).refine(ids=>new Set(ids).size===ids.length,'Select each lead once')}).strict();
const legacyDraft=z.object({name:z.string().trim().min(3).max(120),templateName:z.string().min(1).max(120),audience:z.string().max(100).default('all')}).strict();
function wrap(fn:(req:R,res:Response)=>Promise<unknown>):RequestHandler{return(req,res,next)=>{void fn(req as R,res).catch(next)}}
const consentOrder=[{createdAt:'desc' as const},{optedIn:'asc' as const},{id:'desc' as const}];
export function matchingApprovedTemplate(campaign:{templateId:string;templateName:string;templateBody:string|null;templateLanguage:string|null},templates:Awaited<ReturnType<typeof listWhatsAppTemplates>>){
 const match=campaign.templateId.startsWith('local:')?templates.find(item=>item.name===campaign.templateName&&item.language===campaign.templateLanguage&&item.body===campaign.templateBody):templates.find(item=>item.id===campaign.templateId);
 return match?.supported&&match.name===campaign.templateName&&(campaign.templateBody===null||match.body===campaign.templateBody)&&(campaign.templateLanguage===null||match.language===campaign.templateLanguage)?match:undefined;
}

export function registerCampaigns(app:Express,db:PrismaClient,auth:RequestHandler,requireRole:(...roles:Role[])=>RequestHandler,listTemplates:typeof listWhatsAppTemplates=listWhatsAppTemplates){
 const allowed=requireRole(...roles);
 app.get('/api/v1/campaign-template-drafts',auth,requireRole(...leadEditors,Role.MARKETING),wrap(async(_req,res)=>res.json(await db.campaignTemplateDraft.findMany({orderBy:{createdAt:'desc'}}))));
 app.post('/api/v1/campaign-template-drafts',auth,allowed,wrap(async(req,res)=>{
  const input=templateDraftInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Enter a lowercase template name, language code and message with consecutive numbered variables.'});
  return res.status(201).json(await db.campaignTemplateDraft.create({data:{...input.data,parameterCount:templateParameterCount(input.data.body)!}}));
 }));
 app.patch('/api/v1/campaign-template-drafts/:id',auth,allowed,wrap(async(req,res)=>{
  const input=templateDraftInput.safeParse(req.body);if(!z.string().uuid().safeParse(req.params.id).success||!input.success)return res.status(400).json({error:'Enter a valid draft name, language and message.'});
  const updated=await db.campaignTemplateDraft.updateMany({where:{id:req.params.id},data:{...input.data,parameterCount:templateParameterCount(input.data.body)!}});
  if(!updated.count)return res.status(404).json({error:'Template draft not found'});return res.json({ok:true});
 }));
 app.delete('/api/v1/campaign-template-drafts/:id',auth,allowed,wrap(async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Invalid template draft.'});
  const deleted=await db.campaignTemplateDraft.deleteMany({where:{id:req.params.id}});if(!deleted.count)return res.status(404).json({error:'Template draft not found'});return res.json({ok:true});
 }));
 app.get('/api/v1/campaigns',auth,wrap(async(_req,res)=>res.json(await db.campaign.findMany({orderBy:{createdAt:'desc'},select:{id:true,name:true,templateName:true,status:true,audience:true,createdAt:true,_count:{select:{recipients:true}}}}))));
 app.post('/api/v1/campaigns',auth,allowed,wrap(async(req,res)=>{
  const input=draft.safeParse(req.body);if(!input.success){const legacy=legacyDraft.safeParse(req.body);if(legacy.success)return res.status(201).json(await db.campaign.create({data:legacy.data}));return res.status(400).json({error:'Enter a campaign name, select an approved template and at least one unique lead (maximum 500).'});}
  let template;
  if(input.data.templateId.startsWith('local:')){
   const id=input.data.templateId.slice(6);if(!z.string().uuid().safeParse(id).success)return res.status(400).json({error:'Invalid template draft.'});
   const saved=await db.campaignTemplateDraft.findUnique({where:{id}});if(saved)template={...saved,id:'local:'+saved.id,supported:true};
  }else{let templates;try{templates=await listTemplates()}catch(e){if(e instanceof DeliveryError)return res.status(503).json({error:e.message});throw e}template=templates.find(item=>item.id===input.data.templateId);}
  if(!template?.supported||template.parameterCount!==input.data.parameters.length)return res.status(400).json({error:'Select a supported approved template and fill all variables.'});
  const leads=await db.lead.findMany({where:{id:{in:input.data.leadIds}},select:{id:true,phone:true}});
  if(leads.length!==input.data.leadIds.length)return res.status(400).json({error:'One or more selected leads no longer exist.'});
  if(new Set(leads.map(lead=>lead.phone)).size!==leads.length)return res.status(400).json({error:'Selected leads contain the same phone number. Select only one lead per phone number.'});
  const saved=await db.campaign.create({data:{name:input.data.name,templateName:template.name,templateId:template.id,templateBody:template.body,templateLanguage:template.language,parameters:input.data.parameters,audience:'selected',recipients:{create:leads.map(lead=>({leadId:lead.id}))}}});
  return res.status(201).json(saved);
 }));
 app.get('/api/v1/campaigns/:id/report',auth,allowed,wrap(async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Invalid campaign'});
  const campaign=await db.campaign.findUnique({where:{id:req.params.id},include:{recipients:{include:{lead:{select:{id:true,name:true,phone:true}},outboundMessage:{select:{status:true,error:true}}},orderBy:{id:'asc'}}}});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const recipients=campaign.recipients.map(item=>({id:item.id,lead:item.lead,status:item.outboundMessage?.status||item.status,error:item.outboundMessage?.error||item.error}));
  const counts:Record<string,number>={};for(const item of recipients)counts[item.status]=(counts[item.status]||0)+1;
  return res.json({id:campaign.id,name:campaign.name,status:campaign.status,templateName:campaign.templateName,counts,recipients});
 }));
 app.post('/api/v1/campaigns/:id/start',auth,allowed,wrap(async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Invalid campaign'});
  const campaign=await db.campaign.findUnique({where:{id:req.params.id},include:{_count:{select:{recipients:true}}}});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  if(!campaign.templateId||!campaign._count.recipients)return res.status(400).json({error:'Older drafts have no saved audience or template. Create a new campaign.'});
  if(!['DRAFT','PAUSED'].includes(campaign.status))return res.status(409).json({error:'Campaign has already started or finished.'});
  if(process.env.CAMPAIGN_WORKER_ENABLED!=='true'||!whatsappConfigured())return res.status(503).json({error:'Configure WhatsApp and enable the campaign worker on the API server before starting a campaign.'});
  let templates;try{templates=await listTemplates()}catch(e){if(e instanceof DeliveryError)return res.status(503).json({error:e.message});throw e}
  const parameters=z.array(z.string()).safeParse(campaign.parameters);
  const template=matchingApprovedTemplate({...campaign,templateId:campaign.templateId},templates);
  if(!parameters.success||!template||template.parameterCount!==parameters.data.length)return res.status(400).json({error:'A matching approved Meta template was not found, or its content has changed. Check its name, language, text and approval.'});
  const result=await db.campaign.updateMany({where:{id:campaign.id,status:{in:['DRAFT','PAUSED']}},data:{status:'SCHEDULED',startedById:req.auth!.sub,templateId:template.id,templateBody:template.body,templateLanguage:template.language}});
  if(!result.count)return res.status(409).json({error:'Campaign was already started.'});
  return res.json({ok:true});
 }));
 app.post('/api/v1/campaigns/:id/pause',auth,allowed,wrap(async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Invalid campaign'});
  const result=await db.campaign.updateMany({where:{id:req.params.id,status:'SCHEDULED'},data:{status:'PAUSED'}});
  if(!result.count)return res.status(409).json({error:'Campaign is not running.'});return res.json({ok:true});
 }));
}

// A claim and its outbound record are committed before calling Meta. Claimed messages
// are never retried automatically because a network failure can mean Meta accepted one.
type CampaignDependencies={configured:()=>boolean;list:typeof listWhatsAppTemplates;send:typeof sendWhatsAppTemplate;receipts:typeof applyWhatsAppReceipts};
export async function processCampaigns(db:PrismaClient,dependencies:CampaignDependencies={configured:()=>process.env.CAMPAIGN_WORKER_ENABLED==='true'&&whatsappConfigured(),list:listWhatsAppTemplates,send:sendWhatsAppTemplate,receipts:applyWhatsAppReceipts}){
 if(!dependencies.configured())return;
 const stale=new Date(Date.now()-10*60*1000);
 await db.$transaction(async tx=>{const stuck=await tx.campaignRecipient.findMany({where:{status:'SENDING',claimedAt:{lt:stale}},select:{id:true,outboundMessageId:true}});for(const item of stuck){const changed=await tx.campaignRecipient.updateMany({where:{id:item.id,status:'SENDING',claimedAt:{lt:stale}},data:{status:'UNKNOWN',error:'Send outcome unknown. Check Meta before sending again.'}});if(changed.count&&item.outboundMessageId)await tx.outboundMessage.updateMany({where:{id:item.outboundMessageId,status:'SENDING'},data:{status:'UNKNOWN',error:'Send outcome unknown. Check Meta before sending again.'}});}});
 const next=await db.campaignRecipient.findFirst({where:{status:'PENDING',campaign:{status:'SCHEDULED'}},include:{campaign:true,lead:true},orderBy:{id:'asc'}});
 if(!next){const running=await db.campaign.findMany({where:{status:'SCHEDULED'},select:{id:true}});for(const item of running){if(!await db.campaignRecipient.count({where:{campaignId:item.id,status:{in:['PENDING','SENDING']}}}))await db.campaign.updateMany({where:{id:item.id,status:'SCHEDULED'},data:{status:'COMPLETED'}});}return;}
 const params=z.array(z.string()).safeParse(next.campaign.parameters);if(!next.campaign.templateId||!next.campaign.startedById||!params.success){await db.campaign.updateMany({where:{id:next.campaignId,status:'SCHEDULED'},data:{status:'PAUSED'}});return;}
 let templates;try{templates=await dependencies.list()}catch{await db.campaign.updateMany({where:{id:next.campaignId,status:'SCHEDULED'},data:{status:'PAUSED'}});return;}
 const template=templates.find(item=>item.id===next.campaign.templateId);
 if(!template?.supported||template.name!==next.campaign.templateName||params.data.length!==template.parameterCount||(next.campaign.templateBody!=null&&next.campaign.templateBody!==template.body)||(next.campaign.templateLanguage!=null&&next.campaign.templateLanguage!==template.language)){await db.campaign.updateMany({where:{id:next.campaignId,status:'SCHEDULED'},data:{status:'PAUSED'}});return;}
 const body=template.body.replace(/\{\{(\d+)\}\}/g,(_all,index:string)=>params.data[Number(index)-1]||'');
 const requestId=randomUUID();
 const message=await db.$transaction(async tx=>{
  const claim=await tx.campaignRecipient.updateMany({where:{id:next.id,status:'PENDING',campaign:{status:'SCHEDULED'}},data:{status:'SENDING',claimedAt:new Date()}});if(!claim.count)return null;
  const consent=await tx.leadConsent.findFirst({where:{leadId:next.leadId},orderBy:consentOrder});
  if(!consent?.optedIn){await tx.campaignRecipient.update({where:{id:next.id},data:{status:'SKIPPED',error:'No current explicit WhatsApp opt-in.'}});return null;}
  const saved=await tx.outboundMessage.create({data:{requestId,fingerprint:createHash('sha256').update(`${next.id}:${template.id}`).digest('hex'),leadId:next.leadId,userId:next.campaign.startedById!,channel:'WHATSAPP',subject:template.name,body,recipient:next.lead.phone}});
  await tx.campaignRecipient.update({where:{id:next.id},data:{outboundMessageId:saved.id}});return saved;
 });
 if(!message)return;
 const latest=await db.leadConsent.findFirst({where:{leadId:next.leadId},orderBy:consentOrder});
  if(!latest?.optedIn){await db.$transaction([db.outboundMessage.update({where:{id:message.id},data:{status:'SKIPPED',error:'WhatsApp permission was withdrawn before sending.'}}),db.campaignRecipient.update({where:{id:next.id},data:{status:'SKIPPED'}})]);return;}
  const active=await db.campaignRecipient.findFirst({where:{id:next.id,status:'SENDING',claimedAt:{gte:new Date(Date.now()-10*60*1000)},campaign:{status:'SCHEDULED'}},select:{id:true}});
  if(!active){await db.outboundMessage.updateMany({where:{id:message.id,status:'SENDING'},data:{status:'UNKNOWN',error:'Send was interrupted before confirmation. Check the campaign report.'}});await db.campaignRecipient.updateMany({where:{id:next.id,status:'SENDING'},data:{status:'UNKNOWN'}});return;}
 try{const providerId=await dependencies.send(next.lead.phone,template,params.data);await db.outboundMessage.update({where:{id:message.id},data:{providerId,status:'ACCEPTED'}});await dependencies.receipts(db,providerId);await db.campaignRecipient.updateMany({where:{id:next.id,status:'SENDING'},data:{status:'SENT'}});}
 catch(e){const uncertain=!(e instanceof DeliveryError)||e.uncertain;await db.outboundMessage.updateMany({where:{id:message.id,status:'SENDING'},data:{status:uncertain?'UNKNOWN':'FAILED',error:e instanceof DeliveryError?e.message:'Send outcome unknown. Check Meta before sending again.'}});await db.campaignRecipient.updateMany({where:{id:next.id,status:'SENDING'},data:{status:uncertain?'UNKNOWN':'FAILED'}});}
}
