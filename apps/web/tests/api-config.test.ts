import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {resolveApiBase} from '../src/api-config.js';
test('production requires a reachable HTTPS API and normalizes its path',()=>{
 assert.throws(()=>resolveApiBase(undefined,true),/not configured/);
 assert.throws(()=>resolveApiBase('http://localhost:4000/api/v1',true),/public HTTPS/);
 assert.throws(()=>resolveApiBase('https://localhost:4000/api/v1',true),/public HTTPS/);
 assert.equal(resolveApiBase(' https://example.onrender.com/ ',true),'https://example.onrender.com/api/v1');
 assert.equal(resolveApiBase('https://example.onrender.com/api/v1/',true),'https://example.onrender.com/api/v1');
 assert.throws(()=>resolveApiBase('https://example.onrender.com/auth/login',true),/end in/);
 assert.throws(()=>resolveApiBase('https://user:secret@example.com',true),/credentials/);
 assert.equal(resolveApiBase(undefined,false),'http://localhost:4000/api/v1');
 assert.equal(resolveApiBase('/api/v1',true),'/api/v1');
});
