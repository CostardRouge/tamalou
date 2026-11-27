// A ranked player's identity (ADR-0029): no account, no e-mail, no password. The device draws a secret, keeps it, and
// shows it once as a recovery code; the server keeps only its hash. Whoever holds the code is the player, on any phone.
//
// The secret is 25 symbols of Crockford's base 32 (125 random bits): far beyond guessing, so a plain SHA-256 is enough
// to store it (a slow password hash is for secrets people choose). Typing it back forgives case, spaces, dashes and the
// letters that look like digits.

/** Crockford's base 32: no I, L, O or U. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 25;
const GROUP = 5;

export type RandomBytes = (n: number) => Uint8Array;

const randomBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/** A new secret, as stored on the device: 25 symbols, no dashes. 256 is a multiple of 32, so each symbol is uniform. */
export function newSecret(bytes: RandomBytes = randomBytes): string {
  return Array.from(bytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % 32]).join('');
}

/** The secret a typed code stands for, or null when it cannot be one. */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replaceAll('O', '0').replace(/[IL]/g, '1');
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** The recovery code as shown: five groups of five. */
export function formatCode(secret: string): string {
  const groups: string[] = [];
  for (let i = 0; i < secret.length; i += GROUP) groups.push(secret.slice(i, i + GROUP));
  return groups.join('-');
}

/** What the server keeps of a secret. */
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tamalou-ranked:${secret}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A player's public id: 12 random bytes in base64url. */
export function newPlayerId(bytes: RandomBytes = randomBytes): string {
  let s = '';
  for (const b of bytes(12)) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_');
}
