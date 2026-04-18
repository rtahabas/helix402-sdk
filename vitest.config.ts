import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'packages/contracts'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/types.ts'],
    },
  },
});
