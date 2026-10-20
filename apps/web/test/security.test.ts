import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { analyticsConfig } from '../build/analytics.ts';
import { pageHead } from '../build/pages.ts';
import { precacheList } from '../build/pwa.ts';
import {
  ANALYTICS_ORIGIN,
  contentSecurityPolicy,
  headersFile,
  scriptHash,
  securityHeaders,
} from '../build/security.ts';
import { generatedFiles } from '../build/seo.ts';
import { ANALYTICS, PAGES, SITE_URL } from '../build/site.ts';

// The response headers (COMMON-PROJECT-SPEC C16): one list in build/security.ts, written into `_headers` at the root
// of the build for Cloudflare's asset server and read back by the LAN server (apps/server/src/headers.ts). Held here
// to the pages' own inline scripts, and the file to the list.

/** The `/*` block as apps/server/src/headers.ts reads it: `  Name: value` lines up to the first blank one. */
function parseBlock(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = text.split('\n');
  for (const line of lines.slice(lines.indexOf('/*') + 1)) {
    const m = /^\s+([\w-]+):\s*(.+)$/.exec(line);
    if (!m) break;
    headers[m[1] ?? ''] = (m[2] ?? '').trim();
  }
  return headers;
}

describe('security headers', () => {
  it('names every inline script of every page by hash, and nothing by unsafe-inline', () => {
    const policy = contentSecurityPolicy();
    const script = policy.split('; ').find((d) => d.startsWith('script-src '));
    expect(script).toBeDefined();
    expect(script).not.toContain('unsafe-inline');
    let inline = 0;
    const analytics = analyticsConfig({}, { production: true, url: SITE_URL });
    for (const page of PAGES) {
      for (const m of pageHead(page, SITE_URL, analytics).matchAll(/<script>([\s\S]*?)<\/script>/g)) {
        inline += 1;
        expect(script, `${page.file}: ${m[1]}`).toContain(scriptHash(m[1] ?? ''));
      }
    }
    // The home pages forward old links, jouer/ moves: three scripts, no more.
    expect(inline).toBe(3);
    expect(scriptHash('x')).toBe(`'sha256-${createHash('sha256').update('x').digest('base64')}'`);
  });

  it('lets the pages reach the tracker and nothing else outside the site', () => {
    const policy = contentSecurityPolicy();
    expect(ANALYTICS_ORIGIN).toBe(new URL(ANALYTICS.src).origin);
    expect(policy).toContain(`script-src 'self' 'sha256-`);
    expect(policy).toContain(`connect-src 'self' ${ANALYTICS_ORIGIN}`);
    for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"])
      expect(policy).toContain(directive);
    expect(policy).not.toMatch(/https?:\/\/(?!insight\.steevepommier\.com)/);
  });

  it('starts the policy as Report-Only, beside the fixed headers', () => {
    const headers = securityHeaders();
    expect(headers['Content-Security-Policy-Report-Only']).toBe(contentSecurityPolicy());
    expect(headers['Content-Security-Policy']).toBeUndefined();
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('writes the list into the _headers file the servers read, and keeps the file off the phone', () => {
    const file = headersFile();
    expect(file.startsWith('/*\n')).toBe(true);
    expect(parseBlock(file)).toEqual(securityHeaders());
    expect(file).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable');
    expect(file).toContain('/llms.txt\n  Content-Type: text/markdown; charset=utf-8');
    expect(generatedFiles(SITE_URL, '2026-10-19')._headers?.body).toBe(file);
    expect(precacheList(['_headers', 'index.html'])).toEqual(['index.html']);
  });
});
