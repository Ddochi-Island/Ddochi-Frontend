/**
 * Catch-all proxy for /dashboard/* → tel_router via Cloudflare Tunnel.
 *
 * The tel_router dashboard Vue SPA lives at /dashboard/ on the tunnel host
 * (app.ddochi.cloud). This Function makes it accessible from the Pages host
 * (page.ddochi.cloud) without exposing the tunnel hostname to the browser.
 *
 * Auth model: tel_router's dashboard SPA handles its own JWT auth (picks up
 * token from URL hash, calls /dashboard/stats with Bearer). This Function
 * is a transparent proxy — it forwards Authorization headers so those calls
 * work, and passes through all response headers (CSP, Cache-Control, etc.)
 *
 * Env (shared with api/[[path]].ts — set via wrangler.toml):
 *   ORIGIN_API_URL   public tunnel hostname, e.g. https://app.ddochi.cloud
 */
interface Env {
  ORIGIN_API_URL: string;
}

const TIMEOUT_MS = 28_000;

const FORWARDED_REQ_HEADERS = new Set([
  'authorization',
  'accept',
  'accept-language',
  'accept-encoding',
  'cache-control',
  'content-type',
  'content-length',
  'if-none-match',
  'if-modified-since',
  'range',
  'user-agent',
]);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (!env.ORIGIN_API_URL) {
    return new Response(JSON.stringify({ error: 'pages_function_misconfigured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const incoming = new URL(request.url);
  const origin = new URL(env.ORIGIN_API_URL);
  origin.pathname = incoming.pathname;
  origin.search = incoming.search;

  const forwardHeaders = new Headers();
  for (const [k, v] of request.headers) {
    if (FORWARDED_REQ_HEADERS.has(k.toLowerCase())) forwardHeaders.set(k, v);
  }
  forwardHeaders.set('Host', origin.host);

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) forwardHeaders.set('X-Forwarded-For', cfIp);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(origin.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (ctrl.signal.aborted) {
      return new Response(JSON.stringify({ error: 'origin_timeout' }), { status: 504, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'origin_unreachable' }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
  clearTimeout(timer);

  // Pass through all response headers from tel_router (CSP, Cache-Control,
  // Content-Type, ETag, etc.) so the SPA and assets behave correctly.
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('set-cookie');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
};
