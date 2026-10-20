import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The response headers of the LAN server are the web build's (COMMON-PROJECT-SPEC C16): apps/web/build/security.ts
// writes them once into `_headers` at the root of the build, in the format Cloudflare's asset server reads for the
// online pages, and this reads the same file at startup so the two servers cannot drift. Only the `/*` block counts:
// every line of it is `  Name: value`, and the block ends at the first blank line.

/** The `/*` block of a `_headers` file, header names lowercased as Node writes them. */
export function parseHeadersFile(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = text.split('\n');
  const start = lines.indexOf('/*');
  if (start < 0) return headers;
  for (const line of lines.slice(start + 1)) {
    const m = /^\s+([\w-]+):\s*(.+)$/.exec(line);
    if (!m) break;
    headers[(m[1] ?? '').toLowerCase()] = (m[2] ?? '').trim();
  }
  return headers;
}

/** The headers to send with every response, from the build's `_headers`; none when the file is missing. */
export function readHeaders(staticDir: string): Record<string, string> {
  try {
    return parseHeadersFile(readFileSync(join(staticDir, '_headers'), 'utf8'));
  } catch {
    return {};
  }
}
