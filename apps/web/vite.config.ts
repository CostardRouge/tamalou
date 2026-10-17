import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { inputs, pages } from './build/pages.ts';
import { pwa } from './build/pwa.ts';

export default defineConfig({
  // Relative asset paths: the same build works at a domain's root and under GitHub Pages' /tamalou/.
  base: './',
  plugins: [react(), pages(), pwa()],
  // One HTML file per page of build/site.ts: the home pages, the game under jouer/ (ADR-0017).
  build: { target: 'es2022', rolldownOptions: { input: inputs(import.meta.dirname) } },
  // `pnpm dev` talks to a room server on :8080 (`pnpm serve:lan` or `node apps/server/src/main.ts`) for online play.
  server: { host: true, proxy: { '/api': { target: 'http://localhost:8080', ws: true } } },
});
