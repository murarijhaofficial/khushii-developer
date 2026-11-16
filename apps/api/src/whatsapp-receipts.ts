import {PrismaClient} from '@prisma/client';
import {z} from 'zod';
const receipt=z.object({id:z.string(),status:z.enum(['sent','delivered','read','failed']),timestamp:z.string()});
export async function applyWhatsAppReceipts(db:PrismaClient,providerId:string){
 const events=await db.webhookEvent.findMany({where:{provider:'whatsapp',processedAt:null,payload:{path:['id'],equals:providerId}},orderBy:{receivedAt:'asc'},take:100});
 for(const saved of events){const parsed=receipt.safeParse(saved.payload);if(!parsed.success)continue;const event=parsed.data;
  await db.$transaction(async tx=>{const message=await tx.outboundMessage.findUnique({where:{providerId}});if(!message||message.channel!=='WHATSAPP')return;const claimed=await tx.webhookEvent.updateMany({where:{id:saved.id,processedAt:null},data:{processedAt:new Date()}});if(!claimed.count)return;
   const allowed:Record<string,string[]>={sent:['SENDING','UNKNOWN'],delivered:['SENDING','UNKNOWN','ACCEPTED'],read:['SENDING','UNKNOWN','ACCEPTED','DELIVERED'],failed:['SENDING','UNKNOWN','ACCEPTED']};const state:Record<string,string>={sent:'ACCEPTED',delivered:'DELIVERED',read:'READ',failed:'FAILED'};
   const changed=await tx.outboundMessage.updateMany({where:{id:message.id,status:{in:allowed[event.status]}},data:{status:state[event.status],...(event.status==='failed'?{error:'WhatsApp reported delivery failure.'}:{})}});if(changed.count)await tx.leadActivity.create({data:{leadId:message.leadId,kind:'WHATSAPP_STATUS',body:`WhatsApp message ${event.status}.`}});
  });
 }
}
