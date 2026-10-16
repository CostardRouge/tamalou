import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the same build works at a domain's root and under GitHub Pages' /tamalou/.
  base: './',
  plugins: [react()],
  build: { target: 'es2022' },
  server: { host: true },
});
