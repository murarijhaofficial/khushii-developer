import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {normalizeLayoutImage} from './layout-image.js';
test('layout image validation recognizes actual PNG, JPEG and WebP signatures',()=>{
 const png='iVBORw0KGgo=';const jpeg='/9j/AA==';const webp='UklGRgAAAABXRUJQ';
 assert.deepEqual(normalizeLayoutImage('data:image/png;base64,'+png),{ok:true,data:'data:image/png;base64,'+png});
 assert.deepEqual(normalizeLayoutImage('data:image/png;base64,'+jpeg),{ok:true,data:'data:image/jpeg;base64,'+jpeg});
 assert.deepEqual(normalizeLayoutImage('data:image/jpeg;base64,'+webp),{ok:true,data:'data:image/webp;base64,'+webp});
 assert.equal(normalizeLayoutImage('data:image/png;base64,SGVsbG8=').ok,false);
 assert.equal(normalizeLayoutImage('data:image/svg+xml;base64,PHN2Zz4=').ok,false);
 assert.equal(normalizeLayoutImage('data:image/png;base64,'+png.replace('=','')).ok,false);
});
