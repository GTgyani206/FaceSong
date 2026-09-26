import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Dev-only debug page at /debug (debug/index.html). It is not a build input,
 * so it never ships; this just makes /debug (no trailing slash) reach it.
 */
function debugPage(): Plugin {
  return {
    name: 'facesong-debug-page',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/debug' || req.url?.startsWith('/debug?')) {
          res.writeHead(302, { Location: req.url.replace('/debug', '/debug/') })
          res.end()
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), debugPage()],
  test: {
    // features/ and engine/ must run in plain Node — no DOM.
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
