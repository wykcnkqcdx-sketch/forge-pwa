import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['utils/**/*.test.ts', 'lib/**/*.test.ts', 'hooks/**/*.test.ts'],
    exclude: ['cli/**', 'forge-pwa/**', 'node_modules/**', 'dist/**'],
  },
});
