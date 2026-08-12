import { config as dotenvConfig } from 'dotenv'
import path from 'node:path'

dotenvConfig({ path: path.resolve(__dirname, '../../.env') })

const rootDir = path.resolve(__dirname, '../..')
process.env.SQLITE_DB_PATH = path.resolve(
  rootDir,
  process.env.SQLITE_DB_PATH || './data/local.sqlite',
)

import { defineConfig, type PluginOption } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const isCfDeploy = !!process.env.CF_DEPLOY

async function getCfPlugin(): Promise<PluginOption[]> {
  if (!isCfDeploy) return []
  const { cloudflare } = await import('@cloudflare/vite-plugin')
  return [cloudflare({ viteEnvironment: { name: 'ssr' } })]
}

async function getNitroPlugin(): Promise<PluginOption[]> {
  if (isCfDeploy) return []
  const { nitro } = await import('nitro/vite')
  return [nitro({ rollupConfig: { external: [/^cloudflare:/] } })]
}

const cfPlugin = await getCfPlugin()
const nitroPlugin = await getNitroPlugin()

export default defineConfig({
  envDir: rootDir,
  server: {
    port: 8002,
    allowedHosts: ['test.vikingship.uk'],
  },
  plugins: [
    ...cfPlugin,
    ...nitroPlugin,
    tsconfigPaths(),
    tanstackStart(),
    viteReact(),
  ],
  optimizeDeps: {
    exclude: ['cloudflare:workers'],
  },
  build: isCfDeploy
    ? undefined
    : { rollupOptions: { external: [/^cloudflare:/] } },
  environments: isCfDeploy
    ? {
        ssr: {
          optimizeDeps: {
            include: [
              'react',
              'react-dom',
              'react-dom/server',
              'react/jsx-runtime',
              'react/jsx-dev-runtime',
              'drizzle-orm',
              'drizzle-orm/node-postgres',
              'drizzle-orm/better-sqlite3',
              'drizzle-orm/d1',
              'drizzle-orm/pg-core',
              'drizzle-orm/sqlite-core',
              'better-sqlite3',
              'pg',
              'nanoid',
              'stripe',
              'zod',
            ],
          },
        },
      }
    : undefined,
})
