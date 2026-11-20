import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import express, {type RequestHandler} from 'express';
import {Role, type PrismaClient} from '@prisma/client';
import {registerProjects} from './projects.js';
test('project endpoints enforce role checks, input validation and public plot privacy',async()=>{
 const id='70000000-0000-4000-8000-000000000001';let creates=0;
 const db={project:{findMany:async()=>{throw new Error('database unavailable')},findUnique:async()=>({id}),create:async({data}:{data:unknown})=>{creates++;return data}},plot:{findMany:async()=>[{id,label:'A1',row:1,column:1,area:null,status:'BOOKED'}]}} as unknown as PrismaClient;
 const app=express();app.use(express.json());const auth:RequestHandler=(req,res,next)=>req.header('x-test-role')?next():res.sendStatus(401);
 const requireRole=(...roles:Role[]):RequestHandler=>(req,res,next)=>roles.includes(req.header('x-test-role') as Role)?next():res.sendStatus(403);
 registerProjects(app,db,auth,requireRole);
 app.use((_err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(500).json({error:'Internal server error'}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No address');const base=`http://127.0.0.1:${address.port}/api/v1`;
 try{
  const failedList=await fetch(base+'/projects',{headers:{'x-test-role':'VIEWER'}});assert.equal(failedList.status,500);assert.deepEqual(await failedList.json(),{error:'Internal server error'});
  const body=JSON.stringify({name:'Example',slug:'example',location:null,status:'ACTIVE'});
  assert.equal((await fetch(base+'/projects',{method:'POST',headers:{'content-type':'application/json'},body})).status,401);
  assert.equal((await fetch(base+'/projects',{method:'POST',headers:{'content-type':'application/json','x-test-role':'VIEWER'},body})).status,403);
  assert.equal((await fetch(base+'/projects',{method:'POST',headers:{'content-type':'application/json','x-test-role':'ADMIN'},body:JSON.stringify({name:'x',slug:'INVALID!',location:null,status:'ACTIVE'})})).status,400);
  assert.equal((await fetch(base+'/projects',{method:'POST',headers:{'content-type':'application/json','x-test-role':'ADMIN'},body})).status,201);assert.equal(creates,1);
  const plots=await fetch(base+'/projects/'+id+'/plots',{headers:{'x-test-role':'VIEWER'}});assert.equal(plots.status,200);assert.deepEqual(await plots.json(),[{id,label:'A1',row:1,column:1,area:null,status:'BOOKED'}]);
  assert.equal((await fetch(base+'/plots/'+id+'/bookings',{headers:{'x-test-role':'VIEWER'}})).status,403);
  assert.equal((await fetch(base+'/plots/'+id+'/bookings',{method:'POST',headers:{'content-type':'application/json','x-test-role':'SALES_EXECUTIVE'},body:JSON.stringify({leadId:id,status:'BOOKED'})})).status,403);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
