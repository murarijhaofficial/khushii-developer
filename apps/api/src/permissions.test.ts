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
