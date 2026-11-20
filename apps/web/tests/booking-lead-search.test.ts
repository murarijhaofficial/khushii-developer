import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {findBookingLeads} from '../src/booking-lead-search.ts';
test('booking lead search matches name, phone and email without conflating duplicate names',()=>{
 const leads=[{id:'1',name:'Alex',phone:'123456',email:'first@example.test'},{id:'2',name:'Alex',phone:'987654',email:'second@example.test'}];
 assert.deepEqual(findBookingLeads(leads,'a'),[]);
 assert.deepEqual(findBookingLeads(leads,' ALEX ').map(l=>l.id),['1','2']);
 assert.deepEqual(findBookingLeads(leads,'987').map(l=>l.id),['2']);
 assert.deepEqual(findBookingLeads(leads,'FIRST@').map(l=>l.id),['1']);
 assert.deepEqual(findBookingLeads(leads,'not found'),[]);
});
