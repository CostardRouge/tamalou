import { createHash } from 'node:crypto';
import { inlineScripts } from './pages.ts';
import { MANIFEST_FILE, SW_FILE } from './pwa.ts';
import { ANALYTICS } from './site.ts';

/**
 * The response headers every page of the site carries (COMMON-PROJECT-SPEC C16): one list, written at build time
 * into `_headers` at the root of the build, which Cloudflare's asset server reads for the Worker's pages and the LAN
 * server (apps/server/src/headers.ts) reads at startup for its own responses. GitHub Pages sets no header: the copy
 * there carries none. test/security.test.ts holds the policy to the pages' inline scripts and the file to this list.
 *
 * The Content-Security-Policy is **Report-Only**: it blocks nothing, it only lists in the browser console what an
 * enforced policy would have blocked. Enforce it (rename the header here, nothing else) once a tour of the deployed
 * site — a home page, the game in every mode including a room over a WebSocket, the legal notice with the
 * measurement on — shows a clean console.
 */

/** Where the tracker is loaded from and reports to (build/site.ts): the only third party the pages contact. */
export const ANALYTICS_ORIGIN = new URL(ANALYTICS.src).origin;

/** A CSP source for one inline script's body, exactly as the page writes it between its tags. */
export const scriptHash = (body: string): string => `'sha256-${createHash('sha256').update(body).digest('base64')}'`;

/**
 * The policy. The pages' own inline scripts (the home pages' forwarding of old links, jouer/'s move) are allowed by
 * hash, never by 'unsafe-inline'; Motion and React write style attributes, which no hash can name, so styles keep
 * 'unsafe-inline'. 'self' covers the room's WebSocket on the same host, on the LAN and online alike (CSP 3 matches
 * ws: and wss: against 'self'), the service worker and the manifest; the QR code is inline SVG and needs nothing.
 */
export function contentSecurityPolicy(): string {
  const hashes = [...new Set(inlineScripts().map(scriptHash))];
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} ${ANALYTICS_ORIGIN}`,
    `connect-src 'self' ${ANALYTICS_ORIGIN}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** The headers of every response, in the order the file writes them. */
export function securityHeaders(): Record<string, string> {
  return {
    // Browsers read it over https only: the LAN server's plain http sends it for nothing, harmlessly.
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    // Nothing frames the game; a reported-only policy's frame-ancestors protects nothing yet.
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Sounds are synthesised and vibrations need no permission: no device feature is ever asked for.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy-Report-Only': contentSecurityPolicy(),
  };
}

/**
 * The `_headers` file (Cloudflare's format, read by Workers static assets): the list above under `/*`, then the
 * types and caching the asset server would not guess. The LAN server reads the `/*` block only (it sets its own
 * caching) and every line of it is `  Name: value`, which is what keeps the two readers to one parser.
 */
export function headersFile(): string {
  return [
    '/*',
    ...Object.entries(securityHeaders()).map(([name, value]) => `  ${name}: ${value}`),
    '',
    // The worker and the manifest are checked on every load; the hashed files are kept for a year.
    `/${SW_FILE}`,
    '  Cache-Control: no-cache',
    '',
    `/${MANIFEST_FILE}`,
    '  Content-Type: application/manifest+json; charset=utf-8',
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/llms.txt',
    '  Content-Type: text/markdown; charset=utf-8',
    '',
  ].join('\n');
}
