import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts', 'security/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/vitest.json' },
    env: { ...process.env },
  },
});
