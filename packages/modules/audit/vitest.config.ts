import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'domain/**/*.ts',
        'application/**/*.ts',
        'infrastructure/**/*.ts',
        'presentation/**/*.ts',
      ],
    },
  },
});