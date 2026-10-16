import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      // The CLIs are run by hand and by CI's simulation step, not by unit tests.
      exclude: ['packages/*/src/cli/**'],
      reporter: ['text-summary', 'text', 'html'],
      // The engine and the rules are the product: CI fails below these.
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
});
