import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:4173', ...devices['iPhone 13'], browserName: 'chromium', timezoneId: 'America/Argentina/Buenos_Aires', locale: 'es-AR' },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
})
