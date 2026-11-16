import { createHmac } from 'node:crypto';
import { z } from 'zod';

const item = z.object({
  externalSubmissionId: z.string().max(150).regex(/^(nestoria|khep):/),
  name: z.string().min(2).max(120), phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  email: z.string().email().optional(), message: z.string().max(6000).optional(),
  source: z.literal('website'), projectSlug: z.string().max(150).optional(),
});
const batchSchema = z.object({items:z.array(item).max(50),rejected:z.array(z.object({wordpressId:z.number().int().positive(),reason:z.string().max(200)})).max(50),nextAfter:z.number().int().nonnegative().max(999999999999),hasMore:z.boolean()});
export class WebsiteSyncError extends Error {}
export async function fetchNestoriaBatch(site: string, after: number, secret: string, allowLocal = false) {
  const base = new URL(site);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(allowLocal && base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname)))) throw new WebsiteSyncError('Configure WORDPRESS_SITE_URL as the website HTTPS address.');
  const timestamp=String(Math.floor(Date.now()/1000));
  const canonical=`GET\n/khushii-crm/v1/enquiries?after=${after}&limit=50`;
  const signature='sha256='+createHmac('sha256',secret).update(timestamp+'.'+canonical).digest('hex');
  let response: Response;
  try { response=await fetch(base.href.replace(/\/$/,'')+`/wp-json/khushii-crm/v1/enquiries?after=${after}&limit=50`,{headers:{'X-CRM-Timestamp':timestamp,'X-CRM-Signature':signature},redirect:'error',signal:AbortSignal.timeout(30000)}); }
  catch {throw new WebsiteSyncError('Cannot reach WordPress. Check WORDPRESS_SITE_URL, HTTPS, and the website firewall.');}
  if(!response.ok) {
    const reasons:Record<number,string>={401:'WordPress rejected the signing key. Save the Render WEBHOOK_SHARED_SECRET in the WordPress connector and check server clocks.',403:'WordPress or its firewall blocked the request.',404:'Install Nestoria CRM Connector 0.5.0 or later on WordPress to enable direct sync.',503:'Configure the integration secret in the WordPress connector.'};
    throw new WebsiteSyncError(reasons[response.status]??`WordPress returned HTTP ${response.status}. Check the website server.`);
  }
  const body=await response.text();
  if(body.length>262144)throw new WebsiteSyncError('WordPress returned an oversized response.');
  let json:unknown;try{json=JSON.parse(body)}catch{throw new WebsiteSyncError('WordPress returned HTML or invalid JSON. Check the connector and website firewall.');}
  const result=batchSchema.safeParse(json);
  if(!result.success || result.data.nextAfter<after || (result.data.hasMore && result.data.nextAfter<=after))throw new WebsiteSyncError('WordPress returned an invalid batch or cursor. Update the connector.');
  return result.data;
}
