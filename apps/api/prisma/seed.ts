import 'dotenv/config';
import { PrismaClient, Role, LeadStatus } from '@prisma/client';
import argon2 from 'argon2';
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production seeding is disabled');
  const databaseHost = new URL(process.env.DATABASE_URL ?? '').hostname;
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseHost);
  const password = process.env.DEMO_ADMIN_PASSWORD ?? (isLocal ? 'DemoPass123!' : '');
  if (password.length < 12) throw new Error('Set DEMO_ADMIN_PASSWORD to at least 12 characters before seeding a remote database');
  const hash = await argon2.hash(password);
  await db.user.upsert({where:{email:'admin@khushiideveloper.example'},update:{},create:{name:'Demo Admin',email:'admin@khushiideveloper.example',passwordHash:hash,role:Role.SUPER_ADMIN}});
  const project = await db.project.upsert({where:{slug:'kd-antriksh-residency'},update:{},create:{name:'KD Antriksh Residency',slug:'kd-antriksh-residency',location:'Dholera, Gujarat'}});
  const names=['Rahul Sharma','Priya Patel','Amit Verma','Neha Singh','Vikram Mehta','Sonal Shah','Karan Gupta','Riya Joshi'];
  for (let i=0;i<40;i++) await db.lead.upsert({where:{externalId:`seed-${i}`},update:{},create:{name:names[i%names.length],phone:`+9190000${String(i).padStart(5,'0')}`,email:`lead${i}@example.com`,source:['website','meta','google','chatbot'][i%4],status:Object.values(LeadStatus)[i%Object.values(LeadStatus).length],projectId:project.id,externalId:`seed-${i}`,utmCampaign:'dholera-demo'}});
  await db.campaign.upsert({where:{id:'00000000-0000-4000-8000-000000000001'},update:{},create:{id:'00000000-0000-4000-8000-000000000001',name:'Dholera Follow-up Demo',templateName:'project_followup',audience:'qualified'}});
  console.log('Seed complete. Demo login: admin@khushiideveloper.example (existing account passwords are not changed).');
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e);process.exitCode=1});
