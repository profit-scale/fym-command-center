import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Read VITE_API_BASE from .env.local so the dev proxy can forward to the
  // VPS without triggering CORS. In prod the build runs against the same
  // env var but uses CORS via Caddy on the VPS.
  // Vite injects __dirname-equivalent at config time; using '.' keeps us
  // typescript-clean without needing @types/node just for one cwd lookup.
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.VITE_API_BASE || ''

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5180,
      host: true,
      proxy: apiTarget
        ? {
            '/api': {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
  }
})
