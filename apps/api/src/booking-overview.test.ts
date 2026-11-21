import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import express,{type RequestHandler} from 'express';
import {Role,type PrismaClient} from '@prisma/client';
import {registerBookingOverview} from './booking-overview.js';

test('booking overview exposes counts to all and limits booking details by role',async()=>{
 const calls:unknown[]=[];const bookings=[{id:'b1',agentId:'user-a',status:'BOOKED'},{id:'b2',agentId:'user-b',status:'RESERVED'}];
 const db={project:{findMany:async()=>[{id:'p1',name:'Project A',location:null,status:'ACTIVE'},{id:'p2',name:'Project B',location:null,status:'PLANNING'}]},plot:{groupBy:async()=>[{projectId:'p1',status:'AVAILABLE',_count:{_all:3}},{projectId:'p1',status:'BOOKED',_count:{_all:1}}]},plotBooking:{findMany:async(args:{where:{agentId?:string}})=>{calls.push(args);return bookings.filter(b=>!args.where.agentId||b.agentId===args.where.agentId)}}} as unknown as PrismaClient;
 const app=express();const auth:RequestHandler=(req,res,next)=>{const role=req.header('x-test-role');if(!role)return res.sendStatus(401);(req as typeof req & {auth:{sub:string;role:Role}}).auth={sub:'user-a',role:role as Role};next()};registerBookingOverview(app,db,auth);const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No address');const url=`http://127.0.0.1:${address.port}/api/v1/bookings/overview`;
 try{assert.equal((await fetch(url)).status,401);let response=await fetch(url,{headers:{'x-test-role':'VIEWER'}});let result=await response.json() as {scope:string;projects:{counts:{available:number;booked:number}}[];bookings:unknown[]};assert.equal(result.scope,'none');assert.deepEqual(result.bookings,[]);assert.equal(calls.length,0);assert.equal(result.projects[0].counts.available,3);assert.equal(result.projects[0].counts.booked,1);assert.equal(result.projects[1].counts.available,0);
 response=await fetch(url,{headers:{'x-test-role':'SALES_EXECUTIVE'}});result=await response.json() as typeof result;assert.equal(result.scope,'own');assert.equal(result.bookings.length,1);assert.equal(((calls[0] as {where:{agentId:string}}).where.agentId),'user-a');
 response=await fetch(url,{headers:{'x-test-role':'ADMIN'}});result=await response.json() as typeof result;assert.equal(result.scope,'all');assert.equal(result.bookings.length,2);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
