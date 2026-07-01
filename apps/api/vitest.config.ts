import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@atlas/shared-kernel/errors': path.resolve(
        __dirname,
        '../../packages/shared-kernel/src/errors/domain-errors.ts',
      ),
      '@atlas/shared-kernel/time': path.resolve(
        __dirname,
        '../../packages/shared-kernel/src/time/clock.ts',
      ),
      '@atlas/shared-kernel': path.resolve(
        __dirname,
        '../../packages/shared-kernel/src/index.ts',
      ),
      '@atlas/platform': path.resolve(__dirname, '../../packages/platform/src/index.ts'),
      '@atlas/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@atlas/module-tenant-identity': path.resolve(
        __dirname,
        '../../packages/modules/tenant-identity/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});