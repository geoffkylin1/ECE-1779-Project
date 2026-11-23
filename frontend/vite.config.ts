import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Where the dev server proxies /api when mock mode is off.
// Override with: API_PROXY_TARGET=http://localhost:9000 npm run dev
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

/**
 * Vite copies everything in public/ into dist/, including the MSW worker.
 * Production builds (VITE_USE_MOCK not "true") must not ship it.
 */
function dropMockWorker(useMock: boolean): Plugin {
  let outDir = 'dist'
  return {
    name: 'splitmate:drop-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      if (!useMock) rmSync(resolve(outDir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), dropMockWorker(loadEnv(mode, process.cwd(), 'VITE_').VITE_USE_MOCK === 'true')],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}))
