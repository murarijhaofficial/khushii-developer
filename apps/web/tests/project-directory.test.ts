import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {filterProjects} from '../src/project-directory.ts';
test('project directory filters by name, location and status without mixing results',()=>{
 const projects=[{id:'a',name:'North Homes',location:'Dholera',status:'ACTIVE'},{id:'b',name:'South Homes',location:'Ahmedabad',status:'PLANNING'},{id:'c',name:'Harbour',location:null,status:'ACTIVE'}];
 assert.deepEqual(filterProjects(projects,'','ALL').map(p=>p.id),['a','b','c']);
 assert.deepEqual(filterProjects(projects,' HOME ','ACTIVE').map(p=>p.id),['a']);
 assert.deepEqual(filterProjects(projects,'AHMEDABAD','ALL').map(p=>p.id),['b']);
 assert.deepEqual(filterProjects(projects,'','COMPLETED'),[]);
});
