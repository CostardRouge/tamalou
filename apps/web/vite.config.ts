import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { inputs, pages } from './build/pages.ts';
import { pwa } from './build/pwa.ts';
import { seo } from './build/seo.ts';

export default defineConfig({
  // Relative asset paths: the same build works at a domain's root and under GitHub Pages' /tamalou/.
  base: './',
  // The pages' heads and bodies, then robots.txt, the sitemap and llms.txt, then the service worker over the whole build.
  plugins: [react(), pages(), seo(), pwa()],
  // One HTML file per page of build/site.ts: the home pages, the game under play/ (ADR-0017).
  build: { target: 'es2022', rolldownOptions: { input: inputs(import.meta.dirname) } },
  // `pnpm dev` talks to a room server on :8080 (`pnpm serve:lan` or `node apps/server/src/main.ts`) for online play.
  server: { host: true, proxy: { '/api': { target: 'http://localhost:8080', ws: true } } },
});
