import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';

// Run only against an isolated, migrated development database with the demo admin seeded.
test('sessions, website forms and signed ingestion enforce access and idempotency', async () => {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL to a test database');
  assert.ok(process.env.TEST_ADMIN_PASSWORD, 'Set TEST_ADMIN_PASSWORD for the test database');
  assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname), 'Integration tests require a local test database');
  const port = 41379;
  const secret = 'integration-test-secret-not-for-production';
  const db = new PrismaClient();
  let formId = '';
  const externalId = `integration-test-${randomUUID()}`;
  const server = spawn(process.execPath, ['dist/server.js'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'test', WEBHOOK_SHARED_SECRET: secret }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/api/v1`;
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (server.exitCode !== null) throw new Error('Test API exited before startup');
      try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch { /* wait for startup */ }
      await delay(100);
    }
    assert.ok(ready, 'Test API did not start');
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@khushiideveloper.example', password: process.env.TEST_ADMIN_PASSWORD }) });
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get('set-cookie');
    assert.ok(cookieHeader?.includes('HttpOnly'));
    const cookie = cookieHeader.split(';')[0];
    const { csrfToken } = await login.json() as { csrfToken: string };
    assert.ok(csrfToken);
    const me = await fetch(base + '/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await fetch(base + '/website-forms')).status, 401);
    assert.equal((await fetch(base + '/website-forms',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({name:'Blocked'})})).status,403);
    const create = await fetch(base + '/website-forms', { method:'POST', headers:{ cookie, 'x-csrf-token':csrfToken, 'content-type':'application/json' }, body:JSON.stringify({name:'Test enquiry form'}) });
    assert.equal(create.status,201);
    formId = (await create.json() as {id:string}).id;
    const formResponse = await fetch(`${base}/public/forms/${formId}`);
    assert.equal(formResponse.status,200);
    assert.equal(formResponse.headers.get('x-frame-options'),null);
    const html = await formResponse.text();
    const submissionId = html.match(/name="submissionId" value="([a-f0-9]{32})"/)?.[1];
    assert.ok(submissionId);
    const formBody = new URLSearchParams({submissionId,name:'Example Visitor',phone:'+919000000001',email:'',message:'Test',website:''});
    for (let i=0;i<2;i++) assert.equal((await fetch(`${base}/public/forms/${formId}/submissions`,{method:'POST',body:formBody})).status,200);
    assert.equal(await db.lead.count({where:{websiteFormId:formId}}),1);
    const disable=await fetch(`${base}/website-forms/${formId}`,{method:'PATCH',headers:{cookie,'x-csrf-token':csrfToken,'content-type':'application/json'},body:JSON.stringify({enabled:false})});
    assert.equal(disable.status,200);
    assert.equal((await fetch(`${base}/public/forms/${formId}/submissions`,{method:'POST',body:formBody})).status,404);
    const signedBody=JSON.stringify({externalSubmissionId:externalId,name:'Example Signed',phone:'+919000000002',source:'website',message:'Project: Example Project\nPlot size: 125 Sq. Yards\nBudget: Example budget\nPreferred visit: 2027-01-01\nMessage: Please call'});
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature='sha256='+createHmac('sha256',secret).update(timestamp+'.').update(signedBody).digest('hex');
    const signedHeaders={'content-type':'application/json','x-crm-timestamp':timestamp,'x-crm-signature':signature};
    assert.equal((await fetch(base+'/integrations/signed-website-leads',{method:'POST',headers:{...signedHeaders,'x-crm-signature':'sha256='+'0'.repeat(64)},body:signedBody})).status,401);
    assert.equal((await fetch(base+'/integrations/signed-website-leads',{method:'POST',headers:{...signedHeaders,'x-crm-timestamp':'1000000000'},body:signedBody})).status,401);
    for(let i=0;i<2;i++) assert.equal((await fetch(base+'/integrations/signed-website-leads',{method:'POST',headers:signedHeaders,body:signedBody})).status,202);
    assert.equal((await fetch(base+'/integrations/website-connection',{method:'POST',headers:signedHeaders,body:signedBody})).status,200);
    assert.equal((await fetch(base+'/integrations/website-connection',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
    assert.equal(await db.lead.count({where:{externalId:`website:${externalId}`}}),1);
    const imported = await db.lead.findUnique({where:{externalId:`website:${externalId}`}});
    assert.ok(imported?.message?.includes('Plot size: 125 Sq. Yards'));
    const listed = await fetch(base+'/leads',{headers:{cookie}});
    assert.equal(listed.status,200);
    const listedLeads = await listed.json() as Array<{id:string;message:string|null}>;
    assert.ok(listedLeads.find(lead=>lead.id===imported?.id)?.message?.includes('Budget: Example budget'));
    const rejected = await fetch(base + '/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(rejected.status, 403);
    const logout = await fetch(base + '/auth/logout', { method: 'POST', headers: { cookie, 'x-csrf-token': csrfToken } });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(base + '/auth/me', { headers: { cookie } })).status, 401);
  } finally {
    server.kill();
    if(formId){await db.lead.deleteMany({where:{websiteFormId:formId}});await db.websiteForm.deleteMany({where:{id:formId}})}
    await db.lead.deleteMany({where:{externalId:`website:${externalId}`}});
    await db.$disconnect();
  }
});
