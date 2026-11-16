import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {emailConfigured,sendEmail,DeliveryError} from './messaging.js';
import {canAccessLead,leadEditors} from './permissions.js';

export async function processDueReminders(db:PrismaClient,deliver=sendEmail,ready=emailConfigured()) {
 if(!ready)return 0;
 const reminders=await db.reminder.findMany({where:{emailNotify:true,emailStatus:'PENDING',completedAt:null,dueAt:{lte:new Date()}},take:50,orderBy:{dueAt:'asc'},include:{user:{select:{id:true,name:true,email:true,role:true}},lead:{select:{id:true,name:true,assignedToId:true}}}});
 let processed=0;
 for(const reminder of reminders){
  if(!leadEditors.includes(reminder.user.role)||!canAccessLead(reminder.user.role,reminder.userId,reminder.lead.assignedToId)){await db.reminder.update({where:{id:reminder.id},data:{emailStatus:'CANCELLED',emailError:'User no longer has access to this lead.'}});continue;}
  const claim=await db.reminder.updateMany({where:{id:reminder.id,emailStatus:'PENDING',completedAt:null},data:{emailStatus:'SENDING'}});if(!claim.count)continue;
  try{await deliver(reminder.user.email,'CRM follow-up reminder',`${reminder.title}\nLead: ${reminder.lead.name}\nDue: ${reminder.dueAt.toISOString()}\nOpen the CRM to follow up and mark this reminder complete.`,`reminder-${reminder.id}`);await db.reminder.update({where:{id:reminder.id},data:{emailStatus:'ACCEPTED',emailError:null}});}
  catch(e){await db.reminder.update({where:{id:reminder.id},data:{emailStatus:e instanceof DeliveryError&&!e.uncertain?'FAILED':'UNKNOWN',emailError:'Reminder email could not be confirmed. Check provider logs; reminder remains due in CRM.'}});}
  processed++;
 }
 return processed;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const db=new PrismaClient();let stopping=false;process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
 async function run(){while(!stopping){try{await processDueReminders(db)}catch{console.error('Reminder worker cycle failed. Check database connectivity.')}if(!stopping)await new Promise(resolve=>setTimeout(resolve,30000))}await db.$disconnect()}
 void run();
}
