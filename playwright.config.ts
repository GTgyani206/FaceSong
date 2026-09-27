import { defineConfig } from '@playwright/test'

// End-to-end tests against the dev server's /debug page with live MediaPipe.
// Unit tests (Vitest) stay on JSON fixtures; see CLAUDE.md.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5199' },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199/debug/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
