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
    // Always a fresh server: it must use the fake Supabase below, never real keys from .env.local.
    reuseExistingServer: false,
    timeout: 120_000,
    // Process env beats .env files in Vite. tests/e2e/helpers.ts mocks this host.
    env: { VITE_SUPABASE_URL: 'https://facesong-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
})
