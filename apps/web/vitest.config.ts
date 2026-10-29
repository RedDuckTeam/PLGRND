import { defineConfig } from 'vitest/config'
import path from 'node:path'

// `unit` runs in `yarn web:test` and inside `yarn web:build`; `capture` holds dev-only fixture generators
// (`yarn workspace web capture`), which read today's code paths and write frozen fixtures.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer',
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
      },
      { extends: true, test: { name: 'capture', environment: 'node', include: ['scripts/**/*.capture.ts'] } },
    ],
  },
})
