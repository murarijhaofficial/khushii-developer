import {Prisma, PrismaClient} from '@prisma/client';
import {z} from 'zod';

// Bare ten-digit numbers are Indian mobile numbers; other countries require + and country code.
export function normalizePhone(value:string):string | null {
 const trimmed=value.trim();
 if(!/^[+\d\s().-]+$/.test(trimmed) || (trimmed.match(/\+/g)||[]).length>1 || (trimmed.includes('+')&&!trimmed.startsWith('+'))) return null;
 const digits=trimmed.replace(/\D/g,'');
 const normalized=trimmed.startsWith('+')?'+'+digits:/^[6-9]\d{9}$/.test(digits)?'+91'+digits:null;
 return normalized && /^\+[1-9]\d{7,14}$/.test(normalized)?normalized:null;
}
export const phoneSchema=z.string().max(40).transform((value,ctx)=>{const phone=normalizePhone(value);if(!phone){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Enter a valid phone with country code, or a 10-digit Indian mobile number.'});return z.NEVER;}return phone;});
type Input={name:string;phone:string;email?:string|null;source:string;message?:string|null;projectId?:string|null;websiteFormId?:string|null;externalId?:string;assignedToId?:string|null;status?:Prisma.LeadCreateInput['status'];utmSource?:string;utmCampaign?:string};
export async function saveEnquiry(db:PrismaClient,input:Input,authorize?:(lead:{assignedToId:string|null})=>boolean){
 return db.$transaction(async tx=>{
  if(input.externalId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.externalId}, 0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.phone}, 1))`;
  if(input.externalId){const prior=await tx.leadEnquiry.findUnique({where:{externalId:input.externalId},include:{lead:true}});if(prior)return {lead:prior.lead,created:false,replayed:true};}
  const lead=await tx.lead.findFirst({where:{phone:input.phone},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  if(lead && authorize && !authorize(lead))return {lead:null,created:false,replayed:false};
  const saved=lead??await tx.lead.create({data:{name:input.name,phone:input.phone,email:input.email,source:input.source,message:input.message,projectId:input.projectId,websiteFormId:input.websiteFormId,externalId:input.externalId,assignedToId:input.assignedToId,status:input.status,utmSource:input.utmSource,utmCampaign:input.utmCampaign}});
  await tx.leadEnquiry.create({data:{leadId:saved.id,externalId:input.externalId,name:input.name,phone:input.phone,email:input.email,source:input.source,message:input.message,projectId:input.projectId,websiteFormId:input.websiteFormId}});
  return {lead:saved,created:!lead,replayed:false};
 });
}
