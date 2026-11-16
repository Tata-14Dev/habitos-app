import { defineConfig } from 'vitest/config'

// Note (Windows): run tests through `npm test` (scripts/vitest.mjs) — it fixes a
// lower-case drive letter in the cwd that makes vitest load twice.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    env: { TZ: 'America/Argentina/Buenos_Aires' },
  },
})
