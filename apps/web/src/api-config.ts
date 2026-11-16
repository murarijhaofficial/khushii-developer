export function resolveApiBase(value: string | undefined, production: boolean): string {
  const configured = value?.trim();
  if (!configured) {
    if (production) throw new Error('API connection is not configured. Set VITE_API_URL in Vercel to your public Render API URL, then redeploy.');
    return 'http://localhost:4000/api/v1';
  }
  if (configured === '/api/v1') return configured;
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error('VITE_API_URL must be a valid API URL. Update it in Vercel and redeploy.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_URL must contain only the public API address, without credentials or query parameters.');
  }
  if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('The deployed CRM needs a public HTTPS API. Replace the localhost VITE_API_URL in Vercel and redeploy.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api/v1') throw new Error('VITE_API_URL must be the API origin or end in /api/v1. Update it in Vercel and redeploy.');
  return url.origin + '/api/v1';
}
