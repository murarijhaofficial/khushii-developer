import {z} from 'zod';

export class DeliveryError extends Error { constructor(message:string,public uncertain=false){super(message);} }
export function emailConfigured(){const from=process.env.EMAIL_FROM||'';return !!process.env.RESEND_API_KEY&&!/[\r\n]/.test(from)&&z.string().email().safeParse(from.match(/<([^>]+)>$/)?.[1]||from).success;}
export function whatsappConfigured(){return ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN'].every(k=>!!process.env[k])&&/^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID||'')&&/^\d+$/.test(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID||'')&&/^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION||'');}
async function providerRequest(url:string,init:RequestInit){
 let response:Response;try{response=await fetch(url,{...init,signal:AbortSignal.timeout(30000),redirect:'error'});}catch{throw new DeliveryError('Provider response was not received. Delivery is unknown; do not resend automatically.',true);}
 if(!response.ok)throw new DeliveryError(`Provider rejected the request (HTTP ${response.status}). Check provider credentials, sender configuration and limits.`,response.status>=500);
 try{return await response.json() as unknown;}catch{throw new DeliveryError('Provider returned an unreadable response; delivery is unknown.',true);}
}
export async function sendEmail(to:string,subject:string,text:string,idempotencyKey:string){
 if(!emailConfigured())throw new DeliveryError('Configure RESEND_API_KEY and a verified EMAIL_FROM on the API server.');
 const data=await providerRequest('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,text})});
 const result=z.object({id:z.string().min(1)}).safeParse(data);if(!result.success)throw new DeliveryError('Email acceptance could not be confirmed.',true);return result.data.id;
}
const component=z.object({type:z.string(),format:z.string().optional(),text:z.string().optional()}).passthrough();
const templateSchema=z.object({id:z.string(),name:z.string(),language:z.string(),status:z.string(),category:z.string().optional(),components:z.array(component)});
export type MessageTemplate={id:string;name:string;language:string;category?:string;body:string;parameterCount:number;supported:boolean};
export async function listWhatsAppTemplates():Promise<MessageTemplate[]>{
 if(!whatsappConfigured())throw new DeliveryError('Configure the WhatsApp Cloud API credentials, API version and webhook secrets on the API server.');
 const all:MessageTemplate[]=[];let after='';
 for(let page=0;page<10;page++){
  const url=new URL(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`);url.searchParams.set('fields','id,name,language,status,category,components');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
  const raw=await providerRequest(url.href,{headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`}});
  const data=z.object({data:z.array(templateSchema),paging:z.object({next:z.string().optional(),cursors:z.object({after:z.string().optional()}).optional()}).optional()}).safeParse(raw);
  if(!data.success)throw new DeliveryError('Could not read approved WhatsApp templates. Check account permissions.');
  for(const t of data.data.data){if(t.status!=='APPROVED')continue;const body=t.components.find(c=>c.type==='BODY')?.text||'';const vars=[...body.matchAll(/\{\{(\d+)\}\}/g)].map(m=>Number(m[1]));const count=vars.length?Math.max(...vars):0;const supported=!!body&&count<=20&&!/\{\{[^\d}]/.test(body)&&t.components.every(c=>c.type==='BODY'||c.type==='FOOTER'||(c.type==='HEADER'&&c.format==='TEXT'&&!c.text?.includes('{{')));all.push({id:t.id,name:t.name,language:t.language,category:t.category,body,parameterCount:count,supported});}
  if(!data.data.paging?.next)break;after=data.data.paging.cursors?.after||'';if(!after)break;
 }
 return all;
}
export async function sendWhatsAppTemplate(to:string,template:MessageTemplate,parameters:string[]){
 if(!template.supported||parameters.length!==template.parameterCount)throw new DeliveryError('Choose a supported approved text template and fill every template variable.');
 const components=parameters.length?[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]:[];
 const data=await providerRequest(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:to.replace(/^\+/,''),type:'template',template:{name:template.name,language:{code:template.language},...(components.length?{components}:{})}})});
 const result=z.object({messages:z.array(z.object({id:z.string().min(1)})).min(1)}).safeParse(data);if(!result.success)throw new DeliveryError('WhatsApp acceptance could not be confirmed.',true);return result.data.messages[0].id;
}
