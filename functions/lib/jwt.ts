/**
 * Tiny HS256 JWT verifier for Cloudflare Workers / Pages Functions.
 *
 * Workers don't have Node's `jsonwebtoken`, but Web Crypto's
 * `crypto.subtle.verify` covers HS256 directly. The Function shares the
 * same JWT_SECRET as services/main, so tokens issued by main verify
 * here without a round-trip.
 *
 * Returns the decoded payload on success, throws on any failure mode:
 *   bad_format / bad_alg / bad_signature / expired
 *
 * Note: this verifier does NOT enforce typ === 'access' — caller
 * decides which token type to accept (e.g. /storage takes access only).
 */
export interface JwtPayload {
  sabun?: string;
  name?: string;
  team?: string;
  position?: string;
  typ?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

const enc = new TextEncoder();

export async function verifyHs256(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw err('bad_format');
  const [headerB64, payloadB64, sigB64] = parts;

  const headerJson = b64urlToText(headerB64);
  const header = JSON.parse(headerJson);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw err('bad_alg');

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = b64urlToBytes(sigB64);
  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!ok) throw err('bad_signature');

  const payload = JSON.parse(b64urlToText(payloadB64)) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) throw err('expired');

  return payload;
}

function b64urlToText(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

function b64urlToBytes(s: string): Uint8Array {
  // Workers expose atob; restore standard base64 padding first.
  const pad = s.length % 4;
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function err(code: string): Error & { code: string } {
  const e = new Error(code) as Error & { code: string };
  e.code = code;
  return e;
}
