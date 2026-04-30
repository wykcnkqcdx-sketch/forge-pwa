import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['utils/**/*.test.ts', 'lib/**/*.test.ts'],
    exclude: ['cli/**', 'forge-pwa/**', 'node_modules/**', 'dist/**'],
  },
});
