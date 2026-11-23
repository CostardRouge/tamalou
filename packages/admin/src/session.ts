// The admin's session (ADR-0024): a token the Worker signs once Sésame has said who signed in, kept in a cookie.
// HMAC-SHA256 over a small JSON payload, with WebCrypto, so the same code runs in the Worker and in Node's tests.
// No server state: a session ends at its expiry, or for everyone when the secret changes.

export interface AdminSession {
  /** Sésame's subject for the person. */
  sub: string;
  name: string;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

/** How long a session lasts: a working day. */
export const SESSION_SECONDS = 8 * 3600;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function key(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('the session secret needs at least 32 characters');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

/** Signs any small JSON value: `payload.signature`, both base64url. */
export async function sign(value: unknown, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(value)));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${b64url(mac)}`;
}

/** The value a token carries, or null when it was not signed with this secret. */
export async function unsign(token: string, secret: string): Promise<unknown> {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return null;
  const macBytes = fromB64url(mac);
  if (!macBytes) return null;
  const ok = await crypto.subtle.verify('HMAC', await key(secret), macBytes, enc.encode(body));
  if (!ok) return null;
  const json = fromB64url(body);
  if (!json) return null;
  try {
    return JSON.parse(new TextDecoder().decode(json));
  } catch {
    return null;
  }
}

export function sessionFor(sub: string, name: string, now: number): AdminSession {
  return { sub, name, exp: Math.floor(now / 1000) + SESSION_SECONDS };
}

/** The session a cookie holds, if it is signed, well formed and not expired. */
export async function readSession(token: string, secret: string, now: number): Promise<AdminSession | null> {
  const v = await unsign(token, secret);
  if (!v || typeof v !== 'object') return null;
  const s = v as Partial<AdminSession>;
  if (typeof s.sub !== 'string' || typeof s.name !== 'string' || typeof s.exp !== 'number') return null;
  if (s.exp * 1000 <= now) return null;
  return { sub: s.sub, name: s.name, exp: s.exp };
}

/** One cookie from a Cookie header. */
export function cookie(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
