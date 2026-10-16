import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the same build works at a domain's root and under GitHub Pages' /tamalou/.
  base: './',
  plugins: [react()],
  build: { target: 'es2022' },
  // `pnpm dev` talks to a room server on :8080 (`pnpm serve:lan` or `node apps/server/src/main.ts`) for online play.
  server: { host: true, proxy: { '/api': { target: 'http://localhost:8080', ws: true } } },
});
