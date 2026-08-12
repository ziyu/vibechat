import { config as dotenvConfig } from 'dotenv'
import path from 'node:path'

dotenvConfig({ path: path.resolve(__dirname, '../../.env') })

// Resolve SQLITE_DB_PATH to absolute — relative paths are resolved against monorepo root
const rootDir = path.resolve(__dirname, '../..')
process.env.SQLITE_DB_PATH = path.resolve(rootDir, process.env.SQLITE_DB_PATH || './data/local.sqlite')

import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

const { nitro } = await import('nitro/vite')

export default defineConfig({
  // Shared VITE_* client variables live in the monorepo root .env file.
  envDir: rootDir,
  server: {
    port: 8001,
    // Allow the Cloudflare Tunnel hostname used for local payment webhooks.
    // Keep this explicit instead of allowing arbitrary Host headers.
    allowedHosts: ['test.vikingship.uk'],
    proxy: {
      '/api': {
        target: process.env.BACKEND_ORIGIN || 'http://localhost:8002',
        changeOrigin: false,
      },
      '/v1': {
        target: process.env.BACKEND_ORIGIN || 'http://localhost:8002',
        changeOrigin: false,
      },
    },
  },
  plugins: [
    nitro(),
    tailwindcss(),
    tsconfigPaths(),
    svgr({ svgrOptions: { icon: true }, include: '**/*.svg' }),
    tanstackStart(),
    viteReact(),
  ],
  ssr: {
    // matrix-js-sdk publishes a few internal directory imports that Node's
    // native ESM loader rejects. Let Vite transform them for the SSR module
    // graph; the app still loads the SDK dynamically in the browser only.
    noExternal: ['streamdown', 'katex', 'rehype-katex', 'matrix-js-sdk'],
  },
})
