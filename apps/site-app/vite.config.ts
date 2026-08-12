import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { nitro } from 'nitro/vite'

dotenvConfig({ path: path.resolve(__dirname, '../../.env') })
const rootDir = path.resolve(__dirname, '../..')

export default defineConfig({
  envDir: rootDir,
  server: {
    port: 8003,
    proxy: {
      '/api/blog': {
        target: process.env.BACKEND_ORIGIN || 'http://localhost:8002',
        changeOrigin: false,
      },
    },
  },
  plugins: [
    nitro(),
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart(),
    viteReact(),
  ],
})
