import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {PrismaClient,Role} from '@prisma/client';
import express,{RequestHandler} from 'express';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {DeliveryError} from './messaging.js';
import {processCampaigns,registerCampaigns,matchingApprovedTemplate} from './campaigns.js';
import {templateDraftInput,templateParameterCount} from './template-drafts.js';

test('template drafts validate consecutive numbered variables',()=>{
 assert.equal(templateParameterCount('Hello {{1}} and {{2}}.'),2);
 assert.equal(templateParameterCount('Hello {{2}}'),null);
 assert.equal(templateParameterCount('Hello {{name}}'),null);
 assert.equal(templateParameterCount('Hello {{21}}'),null);
 assert.equal(templateDraftInput.safeParse({name:'Project Followup',language:'en_US',body:'Hello'}).success,false);
 assert.equal(templateDraftInput.safeParse({name:'project_followup',language:'en_US',body:'Hello {{1}}'}).success,true);
});
test('local campaign draft only resolves to matching approved Meta content',()=>{
 const draft={templateId:'local:example',templateName:'example',templateBody:'Hello {{1}}',templateLanguage:'en_US'};
 const approved={id:'meta-id',name:'example',language:'en_US',body:'Hello {{1}}',parameterCount:1,supported:true};
 assert.equal(matchingApprovedTemplate(draft,[approved])?.id,'meta-id');
 assert.equal(matchingApprovedTemplate(draft,[{...approved,body:'Changed {{1}}'}]),undefined);
 assert.equal(matchingApprovedTemplate(draft,[{...approved,language:'hi'}]),undefined);
 assert.equal(matchingApprovedTemplate(draft,[{...approved,supported:false}]),undefined);
 assert.equal(matchingApprovedTemplate(draft,[]),undefined);
});

function setup(optedIn:boolean,stillOptedIn=optedIn){
 const states:{recipient:string;message:string;sent:number;paused:boolean}={recipient:'PENDING',message:'',sent:0,paused:false};
 const next={id:'recipient',campaignId:'campaign',leadId:'lead',campaign:{templateId:'template',templateName:'approved',startedById:'user',parameters:[],templateBody:'Hello',templateLanguage:'en'},lead:{phone:'+919876543210'}};
 const recipient={findMany:async()=>[],findFirst:async(args:{select?:unknown})=>args.select?(states.recipient==='SENDING'?{id:'recipient'}:null):(states.recipient==='PENDING'?next:null),updateMany:async({data}:{data:{status:string}})=>{if(states.recipient!=='PENDING'&&data.status==='SENDING')return {count:0};states.recipient=data.status;return {count:1}},update:async({data}:{data:{status?:string}})=>{if(data.status)states.recipient=data.status},count:async()=>0};
 const outbound={create:async()=>({id:'message'}),update:async({data}:{data:{status:string}})=>{states.message=data.status},updateMany:async({data}:{data:{status:string}})=>{states.message=data.status;return {count:1}}};
 const campaign={findMany:async()=>[],updateMany:async()=>{states.paused=true;return {count:1}}};
 let consentReads=0;
 const tx={campaignRecipient:recipient,outboundMessage:outbound,leadConsent:{findFirst:async()=>({optedIn:++consentReads===1?optedIn:stillOptedIn})},campaign};
 const db={...tx,$transaction:async(arg:((tx:unknown)=>Promise<unknown>)|Promise<unknown>[])=>typeof arg==='function'?arg(tx):Promise.all(arg)} as unknown as PrismaClient;
 const template={id:'template',name:'approved',language:'en',body:'Hello',parameterCount:0,supported:true};
 const dependencies={configured:()=>true,list:async()=>[template],send:async()=>{states.sent++;return 'provider-id'},receipts:async()=>{}};
 return {states,db,dependencies,next};
}
test('campaign skips a recipient without explicit opt-in',async()=>{const {states,db,dependencies}=setup(false);await processCampaigns(db,dependencies);assert.equal(states.recipient,'SKIPPED');assert.equal(states.sent,0);});
test('campaign does not send if permission is withdrawn after claiming',async()=>{const {states,db,dependencies}=setup(true,false);await processCampaigns(db,dependencies);assert.equal(states.recipient,'SKIPPED');assert.equal(states.message,'SKIPPED');assert.equal(states.sent,0);});
test('campaign records acceptance without treating it as delivery',async()=>{const {states,db,dependencies}=setup(true);await processCampaigns(db,dependencies);assert.equal(states.sent,1);assert.equal(states.message,'ACCEPTED');assert.equal(states.recipient,'SENT');});
test('concurrent workers do not send the same claimed recipient twice',async()=>{const {states,db,dependencies}=setup(true);await Promise.all([processCampaigns(db,dependencies),processCampaigns(db,dependencies)]);assert.equal(states.sent,1);});
test('uncertain provider outcome is not retried automatically',async()=>{const {states,db,dependencies}=setup(true);dependencies.send=async()=>{states.sent++;throw new DeliveryError('Unknown',true)};await processCampaigns(db,dependencies);assert.equal(states.message,'UNKNOWN');assert.equal(states.recipient,'UNKNOWN');await processCampaigns(db,dependencies);assert.equal(states.sent,1);});
test('campaign pauses if its approved template is unavailable',async()=>{const {states,db,dependencies}=setup(true);dependencies.list=async()=>[];await processCampaigns(db,dependencies);assert.equal(states.paused,true);assert.equal(states.sent,0);});
test('campaign pauses when approved template text changes after creation',async()=>{const {states,db,dependencies,next}=setup(true);next.campaign.templateBody='Previously reviewed text';await processCampaigns(db,dependencies);assert.equal(states.paused,true);assert.equal(states.sent,0);});

test('campaign drafts validate audience and enforce roles',async()=>{
 const ids=[randomUUID(),randomUUID()];const draftId=randomUUID();let duplicatePhone=false;let savedRecipients=0;let providerAvailable=true;let storedName='';
 const db={lead:{findMany:async()=>ids.map((id,index)=>({id,phone:duplicatePhone?'+919876543210':`+91987654321${index}`}))},campaignTemplateDraft:{findUnique:async()=>({id:draftId,name:'offline_draft',language:'en_US',body:'Hello',parameterCount:0}),create:async({data}:{data:{name:string}})=>({id:draftId,...data}),updateMany:async()=>({count:1}),deleteMany:async()=>({count:1})},campaign:{create:async({data}:{data:{templateName:string;recipients:{create:unknown[]}}})=>{storedName=data.templateName;savedRecipients=data.recipients.create.length;return {id:randomUUID()}}}} as unknown as PrismaClient;
 const app=express();app.use(express.json());
 const auth:RequestHandler=(req,_res,next)=>{(req as typeof req&{auth:{sub:string;role:Role}}).auth={sub:'test',role:req.header('x-test-role')==='admin'?Role.ADMIN:Role.VIEWER};next()};
 const requireRole=(...allowed:Role[]):RequestHandler=>(req,res,next)=>{const role=(req as typeof req&{auth:{role:Role}}).auth.role;if(!allowed.includes(role)){res.sendStatus(403);return;}next()};
 registerCampaigns(app,db,auth,requireRole,async()=>{if(!providerAvailable)throw new DeliveryError('Provider not configured');return [{id:'template',name:'test',language:'en',body:'Hello',parameterCount:0,supported:true}]});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 try{const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;const payload={name:'Test campaign',templateId:'template',parameters:[],leadIds:ids};
  const post=(role:string,body:unknown)=>fetch(base+'/campaigns',{method:'POST',headers:{'content-type':'application/json','x-test-role':role},body:JSON.stringify(body)});
  assert.equal((await post('viewer',payload)).status,403);assert.equal((await fetch(base+'/campaigns/'+randomUUID()+'/report',{headers:{'x-test-role':'viewer'}})).status,403);
  assert.equal((await post('admin',{...payload,leadIds:[ids[0],ids[0]]})).status,400);
  duplicatePhone=true;assert.equal((await post('admin',payload)).status,400);
  duplicatePhone=false;assert.equal((await post('admin',payload)).status,201);assert.equal(savedRecipients,2);
  providerAvailable=false;assert.equal((await post('admin',{...payload,templateId:'local:'+draftId})).status,201);assert.equal(storedName,'offline_draft');assert.equal(savedRecipients,2);
  assert.equal((await post('admin',payload)).status,503);
  const localPayload=JSON.stringify({name:'offline_draft',language:'en_US',body:'Hello {{1}}'});
  assert.equal((await fetch(base+'/campaign-template-drafts',{method:'POST',headers:{'content-type':'application/json','x-test-role':'viewer'},body:localPayload})).status,403);
  assert.equal((await fetch(base+'/campaign-template-drafts',{method:'POST',headers:{'content-type':'application/json','x-test-role':'admin'},body:localPayload})).status,201);
  const draftPath=base+'/campaign-template-drafts/'+draftId;
  assert.equal((await fetch(draftPath,{method:'PATCH',headers:{'content-type':'application/json','x-test-role':'viewer'},body:localPayload})).status,403);
  assert.equal((await fetch(draftPath,{method:'PATCH',headers:{'content-type':'application/json','x-test-role':'admin'},body:localPayload})).status,200);
  assert.equal((await fetch(draftPath,{method:'DELETE',headers:{'x-test-role':'viewer'}})).status,403);
  assert.equal((await fetch(draftPath,{method:'DELETE',headers:{'x-test-role':'admin'}})).status,200);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
