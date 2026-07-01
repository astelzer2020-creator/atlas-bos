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
      '@atlas/queue': path.resolve(__dirname, '../../packages/queue/src/index.ts'),
      '@atlas/event-bus': path.resolve(__dirname, '../../packages/event-bus/src/index.ts'),
      '@atlas/module-tenant-identity': path.resolve(
        __dirname,
        '../../packages/modules/tenant-identity/index.ts',
      ),
      '@atlas/module-notifications': path.resolve(
        __dirname,
        '../../packages/modules/notifications/module.ts',
      ),
      '@atlas/module-storage': path.resolve(
        __dirname,
        '../../packages/modules/storage/module.ts',
      ),
      '@atlas/module-audit': path.resolve(
        __dirname,
        '../../packages/modules/audit/module.ts',
      ),
      '@atlas/module-workflow': path.resolve(
        __dirname,
        '../../packages/modules/workflow/module.ts',
      ),
      '@atlas/module-automation': path.resolve(
        __dirname,
        '../../packages/modules/automation/module.ts',
      ),
      '@atlas/module-ai': path.resolve(__dirname, '../../packages/modules/ai/module.ts'),
      '@atlas/module-crm': path.resolve(__dirname, '../../packages/modules/crm/module.ts'),
      '@atlas/module-projects': path.resolve(
        __dirname,
        '../../packages/modules/projects/module.ts',
      ),
      '@atlas/module-finance': path.resolve(
        __dirname,
        '../../packages/modules/finance/module.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});