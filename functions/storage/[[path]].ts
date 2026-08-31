/**
 * /storage/<key> — JWT-protected proxy to OCI Object Storage with edge cache.
 *
 * Per-request flow
 * ────────────────
 *   1. Resolve auth: prefer Authorization: Bearer header, fall back to
 *      `?token=` query param (handy for <img src=>) or an HttpOnly cookie
 *      named "access_token" (future-proof; not currently set by main).
 *   2. Verify JWT with HS256 using the shared JWT_SECRET.
 *      - missing / malformed / wrong-alg / bad-sig: return JSON 401
 *        (XHR caller) or 302 → /login (browser navigation).
 *      - expired: 302 → /login?next=<original> (always — user wants
 *        to come back to the file after re-auth).
 *   3. Cache lookup (Cloudflare Cache API). Cache key includes the
 *      sabun so we don't accidentally serve someone else's file.
 *      (If the same key is universally accessible, drop sabun from the
 *      cache key — controlled by ALLOW_SHARED_CACHE.)
 *   4. Cache miss → sign with SigV4, fetch OCI, stream back to client
 *      AND `ctx.waitUntil(cache.put(...))` so the response keeps moving
 *      while CF stores a copy.
 *
 * Cache strategy
 * ──────────────
 *   - 304/Not-Modified pass-through for ETag matching.
 *   - default TTL 1h; tunable via env (CACHE_TTL_SECONDS) or per-request
 *     ?cache_ttl_seconds=<n> (capped to a max).
 *   - immutable assets (filenames carrying a content hash) get a fixed
 *     1y TTL with the `immutable` cache-control directive.
 *
 * Env
 * ───
 *   JWT_SECRET                  HS256 shared with services/main
 *   OCI_S3_ENDPOINT             https://<ns>.compat.objectstorage.<region>.oraclecloud.com
 *   OCI_S3_REGION               e.g. ap-osaka-1
 *   OCI_BUCKET_NAME             bucket name
 *   OCI_S3_ACCESS_KEY_ID
 *   OCI_S3_SECRET_ACCESS_KEY
 *   CACHE_TTL_SECONDS           default 3600
 *   CACHE_MAX_TTL_SECONDS       default 86400
 *   ALLOW_SHARED_CACHE          "1" → cache key omits sabun (use only
 *                               when files are public-after-auth)
 */
import { verifyHs256 } from '../lib/jwt';
import { signV4Get } from '../lib/sigv4';

interface Env {
  JWT_SECRET: string;
  OCI_S3_ENDPOINT: string;
  OCI_S3_REGION: string;
  OCI_BUCKET_NAME: string;
  OCI_S3_ACCESS_KEY_ID: string;
  OCI_S3_SECRET_ACCESS_KEY: string;
  CACHE_TTL_SECONDS?: string;
  CACHE_MAX_TTL_SECONDS?: string;
  ALLOW_SHARED_CACHE?: string;
}

const IMMUTABLE_HASH_RE = /\.[0-9a-f]{8,}\./i;

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonError(405, 'method_not_allowed');
  }
  if (!isConfigured(env)) {
    return jsonError(500, 'pages_function_misconfigured');
  }

  // ── 1. extract token + decide failure mode ─────────────────────
  const url = new URL(request.url);
  const token = readToken(request, url);
  const wantsHtml = (request.headers.get('accept') || '').includes('text/html');

  if (!token) {
    return wantsHtml
      ? loginRedirect(url.pathname + url.search)
      : jsonError(401, 'auth_required');
  }

  // ── 2. verify JWT ──────────────────────────────────────────────
  let payload;
  try {
    payload = await verifyHs256(token, env.JWT_SECRET);
  } catch (e: any) {
    const code = e?.code === 'expired' ? 'token_expired' : 'invalid_token';
    return wantsHtml
      ? loginRedirect(url.pathname + url.search, code)
      : jsonError(401, code);
  }
  if (payload.typ && payload.typ !== 'access') {
    return wantsHtml ? loginRedirect(url.pathname + url.search) : jsonError(401, 'wrong_token_type');
  }

  // Object key — strip the leading `/storage/` prefix.
  const objectKey = decodeURIComponent(url.pathname.replace(/^\/storage\//, ''));
  if (!objectKey) return jsonError(400, 'object_key_required');

  // ── 3. cache lookup ─────────────────────────────────────────────
  const cache = caches.default;
  const sharedCache = env.ALLOW_SHARED_CACHE === '1';
  const cacheKey = makeCacheKey(url, sharedCache ? null : payload.sabun);

  const cached = await cache.match(cacheKey);
  if (cached) {
    // Browser-side caching — re-emit the same headers and let the
    // client revalidate via If-None-Match if it sent ETag.
    return cached;
  }

  // ── 4. fetch from OCI with SigV4 ────────────────────────────────
  const ociUrl = new URL(env.OCI_S3_ENDPOINT);
  ociUrl.pathname = `/${env.OCI_BUCKET_NAME}/${objectKey}`;

  let signedHeaders: Headers;
  try {
    signedHeaders = await signV4Get({
      method: 'GET',
      url: ociUrl,
      region: env.OCI_S3_REGION,
      service: 's3',
      accessKeyId: env.OCI_S3_ACCESS_KEY_ID,
      secretAccessKey: env.OCI_S3_SECRET_ACCESS_KEY,
    });
  } catch {
    return jsonError(500, 'sigv4_failed');
  }

  // Forward conditional headers if the browser sent any.
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) signedHeaders.set('if-none-match', ifNoneMatch);

  let upstream: Response;
  try {
    upstream = await fetch(ociUrl.toString(), { method: 'GET', headers: signedHeaders });
  } catch {
    return jsonError(502, 'origin_unreachable');
  }

  if (upstream.status === 404) return jsonError(404, 'not_found');
  if (upstream.status === 403) return jsonError(403, 'oci_forbidden');
  if (upstream.status === 304) {
    return new Response(null, {
      status: 304,
      headers: copyCacheHeaders(upstream.headers),
    });
  }
  if (!upstream.ok) return jsonError(502, 'origin_error');

  const ttl = pickTtl(url, env, objectKey);
  const respHeaders = buildResponseHeaders(upstream.headers, ttl, objectKey);
  // `Vary` so the cache differentiates by Authorization when not shared.
  if (!sharedCache) respHeaders.append('vary', 'authorization');

  const response = new Response(upstream.body, {
    status: 200,
    headers: respHeaders,
  });

  // Stash a clone in the edge cache while streaming the original to
  // the client. waitUntil keeps the worker alive until the cache write
  // completes.
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};

// ───────────────────────── helpers ─────────────────────────────────

function isConfigured(env: Env): boolean {
  return Boolean(
    env.JWT_SECRET &&
      env.OCI_S3_ENDPOINT &&
      env.OCI_S3_REGION &&
      env.OCI_BUCKET_NAME &&
      env.OCI_S3_ACCESS_KEY_ID &&
      env.OCI_S3_SECRET_ACCESS_KEY
  );
}

function readToken(request: Request, url: URL): string {
  const auth = request.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const q = url.searchParams.get('token');
  if (q) return q;
  // future: HttpOnly cookie path. Looks for cookie name "access_token".
  const cookie = request.headers.get('cookie') || '';
  const m = /(?:^|;\s*)access_token=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]) : '';
}

function makeCacheKey(reqUrl: URL, sabun: string | null | undefined): Request {
  // Cache API requires a Request, not a string. Strip the ?token=
  // query param so URLs with rotating tokens still hit the same cache.
  const cleaned = new URL(reqUrl.toString());
  cleaned.searchParams.delete('token');
  cleaned.searchParams.delete('cache_ttl_seconds');
  if (sabun) cleaned.searchParams.set('_u', sabun);
  return new Request(cleaned.toString(), { method: 'GET' });
}

function pickTtl(reqUrl: URL, env: Env, objectKey: string): number {
  const def = parseInt(env.CACHE_TTL_SECONDS || '3600', 10);
  const cap = parseInt(env.CACHE_MAX_TTL_SECONDS || '86400', 10);
  const reqTtl = parseInt(reqUrl.searchParams.get('cache_ttl_seconds') || '0', 10);
  if (IMMUTABLE_HASH_RE.test(objectKey)) return cap;
  if (reqTtl > 0) return Math.min(reqTtl, cap);
  return def;
}

function buildResponseHeaders(upstream: Headers, ttl: number, objectKey: string): Headers {
  const out = new Headers();
  // Preserve content metadata, ditch backend-specific noise.
  for (const h of [
    'content-type',
    'content-length',
    'etag',
    'last-modified',
    'content-encoding',
    'content-disposition',
    'accept-ranges',
  ]) {
    const v = upstream.get(h);
    if (v) out.set(h, v);
  }
  // Cache-Control: edge + browser. immutable assets get max + immutable.
  if (IMMUTABLE_HASH_RE.test(objectKey)) {
    out.set('cache-control', `public, max-age=${ttl}, s-maxage=${ttl}, immutable`);
  } else {
    out.set('cache-control', `private, max-age=${ttl}, s-maxage=${ttl}`);
  }
  // Hardening: prevent type confusion, no embeds.
  out.set('x-content-type-options', 'nosniff');
  out.set('referrer-policy', 'no-referrer');
  return out;
}

function copyCacheHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const h of ['etag', 'last-modified', 'cache-control']) {
    const v = upstream.get(h);
    if (v) out.set(h, v);
  }
  return out;
}

function jsonError(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function loginRedirect(next: string, reason?: string): Response {
  const dest = new URL('/login', 'https://placeholder');
  dest.searchParams.set('next', next);
  if (reason) dest.searchParams.set('reason', reason);
  // Use a relative URL so the browser stays on the same origin.
  return Response.redirect('/login' + (dest.search || ''), 302);
}
