import {Express,RequestHandler} from 'express';
import {PrismaClient,Role} from '@prisma/client';

type Actor={sub:string;role:Role};
export function registerBookingOverview(app:Express,db:PrismaClient,auth:RequestHandler){
 app.get('/api/v1/bookings/overview',auth,async(req,res,next)=>{try{
  const actor=(req as typeof req & {auth:Actor}).auth;
  const manager=[Role.SUPER_ADMIN,Role.ADMIN,Role.SALES_MANAGER].some(role=>role===actor.role);
  const own=actor.role===Role.SALES_EXECUTIVE;
  const [projects,counts,records]=await Promise.all([
   db.project.findMany({select:{id:true,name:true,location:true,status:true},orderBy:{name:'asc'}}),
   db.plot.groupBy({by:['projectId','status'],_count:{_all:true}}),
   manager||own?db.plotBooking.findMany({where:{status:{in:['RESERVED','BOOKED']},...(own?{agentId:actor.sub}:{})},select:{id:true,status:true,createdAt:true,lead:{select:{id:true,name:true}},agent:{select:{id:true,name:true}},plot:{select:{id:true,label:true,project:{select:{id:true,name:true}}}}},orderBy:{createdAt:'desc'},take:201}):Promise.resolve(null)
  ]);
  const byProject=new Map<string,{available:number;reserved:number;booked:number}>();
  for(const item of counts){const current=byProject.get(item.projectId)||{available:0,reserved:0,booked:0};if(item.status==='AVAILABLE')current.available=item._count._all;else if(item.status==='RESERVED')current.reserved=item._count._all;else if(item.status==='BOOKED')current.booked=item._count._all;byProject.set(item.projectId,current)}
  res.json({projects:projects.map(project=>({...project,counts:byProject.get(project.id)||{available:0,reserved:0,booked:0}})),scope:manager?'all':own?'own':'none',bookings:records?.slice(0,200)??[],hasMore:(records?.length??0)>200});
 }catch(e){next(e)}});
}
