import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      host: true, // Allow network access for mobile testing
      port: 5173,
      open: true,
      proxy: {
        // Proxy setlist.fm API requests to avoid CORS issues
        '/api/setlistfm': {
          target: 'https://api.setlist.fm/rest/1.0',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/setlistfm/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Add API key header from loaded env
              const apiKey = env.VITE_SETLISTFM_API_KEY
              if (apiKey) {
                proxyReq.setHeader('x-api-key', apiKey)
              }
              proxyReq.setHeader('Accept', 'application/json')
            })
          }
        }
      }
    },
  }
})
