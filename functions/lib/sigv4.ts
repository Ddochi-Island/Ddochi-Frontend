/**
 * AWS Signature V4 signer for Cloudflare Workers / Pages Functions.
 *
 * Used to authenticate requests to OCI Object Storage's S3-compatible
 * endpoint. OCI accepts standard SigV4 with a Customer Secret Key —
 * the AccessKeyId / SecretAccessKey pair generated under an OCI IAM user.
 *
 * Why per-request signing (vs PAR)
 * ────────────────────────────────
 * - Each signed request is time-bound (5min default skew).
 * - Key rotation is independent of code: rotate at OCI, push to CF
 *   secrets, no redeploy needed in code.
 * - IAM user can be scoped to "read-only on bucket X" so a leaked
 *   secret does NOT grant write or other-bucket access.
 * - Per-request signature lands in OCI audit logs distinguishably.
 *
 * This is a minimal SigV4 GET signer — no chunked uploads, no payload
 * signing for non-GET (we only proxy reads). The unsigned-payload
 * variant (`UNSIGNED-PAYLOAD`) is used so we don't hash the (potentially
 * huge) body; OCI accepts this for GET.
 *
 * Spec ref: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 */
const enc = new TextEncoder();

export interface SigV4Input {
  method: 'GET' | 'HEAD';
  url: URL;
  region: string;             // e.g. 'ap-osaka-1'
  service: string;            // 's3'
  accessKeyId: string;
  secretAccessKey: string;
  // Headers we want signed in addition to host. Keep this small —
  // every signed header must appear on the wire identically.
  extraSignedHeaders?: Record<string, string>;
}

export async function signV4Get(input: SigV4Input): Promise<Headers> {
  const { method, url, region, service, accessKeyId, secretAccessKey } = input;

  const now = new Date();
  const amzDate = isoBasic(now);                   // 20240116T123456Z
  const dateStamp = amzDate.slice(0, 8);           // 20240116

  const headers = new Headers(input.extraSignedHeaders || {});
  headers.set('host', url.host);
  headers.set('x-amz-date', amzDate);
  headers.set('x-amz-content-sha256', 'UNSIGNED-PAYLOAD');

  const sortedHeaderNames = [...headers.keys()].map((h) => h.toLowerCase()).sort();
  const canonicalHeaders =
    sortedHeaderNames
      .map((h) => `${h}:${(headers.get(h) || '').trim().replace(/\s+/g, ' ')}`)
      .join('\n') + '\n';
  const signedHeaders = sortedHeaderNames.join(';');

  // Canonical query string — SigV4 requires lexicographic sort and
  // RFC 3986 percent-encoding. URLSearchParams already URL-encodes;
  // we only need the lex sort.
  const params: [string, string][] = [];
  url.searchParams.forEach((v, k) => params.push([k, v]));
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalQuery = params
    .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
    .join('&');

  // Path stays as-is; OCI is permissive with double-encoding so we
  // skip aws-sdk's "encode each segment" subtlety and trust the URL
  // we were handed.
  const canonicalPath = url.pathname || '/';

  const canonicalRequest = [
    method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = bytesToHex(await hmac(kSigning, stringToSign));

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  headers.set('Authorization', authHeader);

  return headers;
}

function isoBasic(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return bytesToHex(new Uint8Array(buf));
}

async function hmac(key: string | Uint8Array, msg: string): Promise<Uint8Array> {
  const keyBytes = typeof key === 'string' ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  return new Uint8Array(sig);
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
