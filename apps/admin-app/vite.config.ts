import { config as dotenvConfig } from 'dotenv'
import path from 'node:path'

dotenvConfig({ path: path.resolve(__dirname, '../../.env') })

const rootDir = path.resolve(__dirname, '../..')

import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

const { nitro } = await import('nitro/vite')

export default defineConfig({
  envDir: rootDir,
  server: {
    port: 8005,
    proxy: {
      '/api': {
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
})
