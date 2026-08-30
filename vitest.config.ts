import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/worldtree/tree.ts',
        'src/editor/context.ts',
        'src/provider/sse.ts',
        'src/provider/mock.ts',
        'src/provider/openai.ts',
        'src/provider/candidates.ts',
        'src/export/exporters.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
