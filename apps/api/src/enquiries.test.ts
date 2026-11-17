import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {normalizePhone} from './enquiries.js';
test('normalizes Indian mobile and international phone formats without matching ambiguous numbers',()=>{
 assert.equal(normalizePhone('98765 43210'),'+919876543210');
 assert.equal(normalizePhone('+91 (98765) 43210'),'+919876543210');
 assert.equal(normalizePhone('+1 212 555 0100'),'+12125550100');
 for(const value of ['1234567890','98765abc43210','++919876543210','123','']) assert.equal(normalizePhone(value),null);
});
