import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Role } from '@prisma/client';
import { canAccessLead, leadEditors, leadManagers } from './permissions.js';
test('sales executives only access their assigned leads', () => {
  assert.equal(canAccessLead(Role.SALES_EXECUTIVE, 'employee', 'employee'), true);
  assert.equal(canAccessLead(Role.SALES_EXECUTIVE, 'employee', 'other'), false);
  assert.equal(canAccessLead(Role.SALES_EXECUTIVE, 'employee', null), false);
  assert.equal(canAccessLead(Role.SALES_MANAGER, 'manager', null), true);
});
test('only sales roles can edit and managers can assign', () => {
  assert.equal(leadEditors.includes(Role.VIEWER), false);
  assert.equal(leadEditors.includes(Role.MARKETING), false);
  assert.equal(leadEditors.includes(Role.SALES_EXECUTIVE), true);
  assert.equal(leadManagers.includes(Role.SALES_EXECUTIVE), false);
  assert.equal(leadManagers.includes(Role.SALES_MANAGER), true);
});

import { parseCorsOrigins } from './cors-config.js';
test('CORS normalizes trailing slashes but keeps an exact origin allowlist', () => {
 assert.deepEqual(parseCorsOrigins(' https://crm.example.test/ ,https://preview.example.test'),['https://crm.example.test','https://preview.example.test']);
 assert.throws(()=>parseCorsOrigins('*'));
 assert.throws(()=>parseCorsOrigins('https://*.vercel.app'));
 assert.throws(()=>parseCorsOrigins('https://crm.example.test/login'));
 assert.throws(()=>parseCorsOrigins('https://user:secret@crm.example.test'));
});
