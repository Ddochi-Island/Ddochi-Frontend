/**
 * Catch-all proxy for /api/* → services/main via Cloudflare Tunnel.
 *
 * Why this exists
 * ───────────────
 * Single-domain topology: the SPA, /api/*, and /storage/* all live on
 * one CF Pages hostname. This Function rewrites the request to the
 * tunnel-backed origin so the SPA never has to know the upstream URL.
 *
 * Auth model: main handles auth itself via Bearer JWT (HS256). This
 * Function is a transparent proxy with header sanitization + size cap
 * + bounded timeout. Auth happens at main, not here.
 *
 * What we do:
 *   - Header allowlist — drop X-Forwarded-* and friends
 *   - Body size cap — 50 MB matches main's body limit
 *   - Bounded timeout — 30s (CF Pages Functions hard cap)
 *   - Surface-clean error — never leak origin URL or stack
 *
 * Env (set via wrangler.toml):
 *   ORIGIN_API_URL              public tunnel hostname (required)
 */
interface Env {
  ORIGIN_API_URL: string;
}

const MAX_BODY_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 28_000;

// Headers we forward to the origin. Anything the browser sets that we
// don't list here is stripped — minimizes surface for header-injection
// games like X-Forwarded-User abuse.
const FORWARDED_HEADERS = new Set([
  'authorization',
  'content-type',
  'content-length',
  'accept',
  'accept-language',
  'user-agent',
  'origin',                           // CORS preflight 전달용
  'x-telegram-bot-api-secret-token', // for /api/telegram-webhook (Telegram → CF → main)
  'x-shared-leads-secret',           // for /api/shared-leads/notify (Apps Script → CF → main)
  'x-shed-key',                       // for /api/shed/users (shed admin → ddochi users)
]);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (!env.ORIGIN_API_URL) {
    return jsonError(500, 'pages_function_misconfigured');
  }

  // Construct origin URL. The catch-all matches everything under /api/,
  // so request.url already carries the right path; we just swap the host.
  const incoming = new URL(request.url);
  const origin = new URL(env.ORIGIN_API_URL);
  origin.pathname = incoming.pathname;
  origin.search = incoming.search;

  // Body size guard — refuse oversize early so we don't tie up worker
  // memory on a known-bad request.
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError(413, 'payload_too_large');
  }

  // Build the forwarded request.
  const forwardHeaders = new Headers();
  for (const [k, v] of request.headers) {
    if (FORWARDED_HEADERS.has(k.toLowerCase())) forwardHeaders.set(k, v);
  }
  forwardHeaders.set('Host', origin.host);
  // Preserve true client IP so main's logger / rate limiter sees it.
  // CF already sets CF-Connecting-IP; pass it through explicitly.
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) forwardHeaders.set('X-Forwarded-For', cfIp);

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    body: hasBody(request.method) ? request.body : undefined,
    redirect: 'manual',
  };

  // Bounded timeout — CF Pages Functions cap is 30s anyway, fail at 28s
  // so we get a clean error instead of a runtime kill.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  init.signal = ctrl.signal;

  let upstream: Response;
  try {
    upstream = await fetch(origin.toString(), init);
  } catch (e) {
    clearTimeout(timer);
    if (ctrl.signal.aborted) return jsonError(504, 'origin_timeout');
    return jsonError(502, 'origin_unreachable');
  }
  clearTimeout(timer);

  // Strip Set-Cookie that the origin may emit unintentionally — main
  // doesn't issue cookies; if it ever does, we'll add an explicit
  // allow rule.
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('set-cookie');
  // Tighten: tell browsers not to cache /api responses by default. Main
  // can still override per-route via its own Cache-Control.
  if (!respHeaders.has('cache-control')) {
    respHeaders.set('cache-control', 'no-store');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
};

function hasBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function jsonError(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
