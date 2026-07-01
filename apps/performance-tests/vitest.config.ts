import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@atlas/module-ai-memory': path.resolve(
        __dirname,
        '../../packages/modules/ai-memory/module.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    testTimeout: 30_000,
  },
});