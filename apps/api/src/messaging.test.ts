import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {emailConfigured,listWhatsAppTemplates,sendEmail,sendWhatsAppTemplate,DeliveryError} from './messaging.js';
test('provider adapters use approved templates, fixed endpoints and idempotent email requests',async()=>{
 const keys=['RESEND_API_KEY','EMAIL_FROM','WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_API_VERSION'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;const calls:{url:string;init?:RequestInit}[]=[];
 try{
  process.env.RESEND_API_KEY='test-only';process.env.EMAIL_FROM='crm@example.test';process.env.WHATSAPP_ACCESS_TOKEN='test-only';process.env.WHATSAPP_APP_SECRET='test-only';process.env.WHATSAPP_VERIFY_TOKEN='test-only';process.env.WHATSAPP_PHONE_NUMBER_ID='123';process.env.WHATSAPP_BUSINESS_ACCOUNT_ID='456';process.env.WHATSAPP_API_VERSION='v27.0';
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return new Response(JSON.stringify(String(url).includes('message_templates')?{data:[{id:'1',name:'followup',language:'en',status:'APPROVED',components:[{type:'BODY',text:'Hello {{1}}'}]},{id:'2',name:'pending',language:'en',status:'PENDING',components:[{type:'BODY',text:'Pending'}]},{id:'3',name:'image',language:'en',status:'APPROVED',components:[{type:'HEADER',format:'IMAGE'},{type:'BODY',text:'Photo'}]}]}:String(url).includes('graph.facebook.com')?{messages:[{id:'wamid.test'}]}:{id:'email-test'}),{status:200,headers:{'Content-Type':'application/json'}})};
  const templates=await listWhatsAppTemplates();assert.equal(templates.length,2);assert.equal(templates[0].parameterCount,1);assert.equal(templates[1].supported,false);
  await assert.rejects(()=>sendWhatsAppTemplate('+919000000001',templates[0],[]),/every template variable/);
  assert.equal(await sendWhatsAppTemplate('+919000000001',templates[0],['Example']),'wamid.test');
  const payload=JSON.parse(String(calls[1].init?.body));assert.equal(payload.template.name,'followup');assert.equal(payload.to,'919000000001');
  assert.equal(await sendEmail('lead@example.test','Hello','Example message','request-test'),'email-test');assert.equal((calls[2].init?.headers as Record<string,string>)['Idempotency-Key'],'request-test');
  globalThis.fetch=async()=>{throw new Error('timeout')};await assert.rejects(()=>sendEmail('lead@example.test','Hello','Example','unknown'),e=>e instanceof DeliveryError&&e.uncertain);
  process.env.EMAIL_FROM='';assert.equal(emailConfigured(),false);
 }finally{globalThis.fetch=originalFetch;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
