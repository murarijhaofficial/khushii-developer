export function parseCorsOrigins(value: string): string[] {
  const origins = value.split(',').map(entry => {
    let url: URL;
    try { url = new URL(entry.trim()); } catch { throw new Error('CORS_ORIGIN must contain complete website origins separated by commas'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CORS_ORIGIN must contain website origins without paths, credentials or query parameters');
    }
    return url.origin;
  });
  return [...new Set(origins)];
}
