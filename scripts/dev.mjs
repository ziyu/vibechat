import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import {
  environmentForNode,
  isSupportedNode,
  resolveCompatibleNode,
} from './node-runtime.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = fileURLToPath(import.meta.url)

if (!isSupportedNode(process.execPath)) {
  const compatibleNode = resolveCompatibleNode()
  console.log(`[dev] Re-launching with compatible Node at ${compatibleNode}`)
  const result = spawnSync(compatibleNode, [scriptPath, ...process.argv.slice(2)], {
    cwd: repositoryRoot,
    env: environmentForNode(compatibleNode),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

for (const filename of ['.env.local', '.env']) {
  const path = join(repositoryRoot, filename)
  if (existsSync(path)) dotenv.config({ path })
}

const mode = process.argv[2] || 'all'
const filters = {
  all: [
    '@vibechat/backend',
    '@vibechat/web-app',
    '@vibechat/site-app',
    '@vibechat/admin-app',
    '@vibechat/space-runtime',
  ],
  web: ['@vibechat/backend', '@vibechat/web-app', '@vibechat/space-runtime'],
}[mode]

if (!filters) {
  throw new Error(`Unknown development mode: ${mode}`)
}

const developmentEnvironment = environmentForNode(process.execPath, {
  ...process.env,
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:8001',
  BACKEND_ORIGIN: process.env.BACKEND_ORIGIN || 'http://localhost:8002',
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ||
    'vibechat-local-dev-secret-32-characters-minimum',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:8001',
  DB_DIALECT: process.env.DB_DIALECT || 'sqlite',
  MATRIX_APPSERVICE_TOKEN:
    process.env.MATRIX_APPSERVICE_TOKEN || 'vibechat-local-appservice-token',
  MATRIX_HOMESERVER_URL:
    process.env.MATRIX_HOMESERVER_URL || 'http://127.0.0.1:8008',
  MATRIX_PUBLIC_HOMESERVER_URL:
    process.env.MATRIX_PUBLIC_HOMESERVER_URL || 'http://localhost:8008',
  MATRIX_SERVER_NAME: process.env.MATRIX_SERVER_NAME || 'localhost',
  MATRIX_TOKEN_ENCRYPTION_KEY:
    process.env.MATRIX_TOKEN_ENCRYPTION_KEY ||
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MATRIX_USER_PREFIX: process.env.MATRIX_USER_PREFIX || 'vibe_',
  SPACE_AGENT_DEFAULT_ID: process.env.SPACE_AGENT_DEFAULT_ID || 'pi',
  SPACE_RUNTIME_CALLBACK_ORIGIN:
    process.env.SPACE_RUNTIME_CALLBACK_ORIGIN || 'http://127.0.0.1:8002',
  SPACE_RUNTIME_INTERNAL_TOKEN:
    process.env.SPACE_RUNTIME_INTERNAL_TOKEN ||
    'vibechat-local-space-runtime-token',
  SPACE_RUNTIME_ORIGIN:
    process.env.SPACE_RUNTIME_ORIGIN || 'http://127.0.0.1:8007',
  SPACE_RUNTIME_PORT: process.env.SPACE_RUNTIME_PORT || '8007',
  SQLITE_DB_PATH:
    process.env.SQLITE_DB_PATH || join(repositoryRoot, 'data', 'local.sqlite'),
})

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: developmentEnvironment,
    stdio: 'inherit',
    ...options,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}`)
  }
}

function runPnpm(args) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args])
    return
  }
  run('pnpm', args)
}

async function ensureLocalDatabase() {
  if (developmentEnvironment.DB_DIALECT !== 'sqlite') return

  const databasePath = resolve(repositoryRoot, developmentEnvironment.SQLITE_DB_PATH)
  developmentEnvironment.SQLITE_DB_PATH = databasePath
  if (existsSync(databasePath)) return

  console.log(`[dev] Initializing local SQLite database at ${databasePath}`)
  await mkdir(dirname(databasePath), { recursive: true })
  runPnpm(['db:push:sqlite'])
  runPnpm(['db:seed:sqlite'])
}

async function ensureLocalSynapse() {
  if (process.env.VIBECHAT_DEV_SKIP_SYNAPSE === '1') {
    console.log('[dev] Skipping local Synapse because VIBECHAT_DEV_SKIP_SYNAPSE=1')
    return
  }

  const docker = spawnSync('docker', ['info'], { stdio: 'ignore' })
  if (docker.error || docker.status !== 0) {
    throw new Error(
      'Local Synapse requires a running Docker-compatible engine. Start Docker or OrbStack, then run pnpm dev again.',
    )
  }

  const signingKey = join(
    repositoryRoot,
    'docker-volumes',
    'synapse',
    'localhost.signing.key',
  )
  if (!existsSync(signingKey)) {
    console.log('[dev] Initializing local Synapse')
    run('docker', [
      'compose',
      '--profile',
      'matrix-init',
      'run',
      '--rm',
      'synapse-init',
    ])
  }

  console.log('[dev] Starting local Synapse')
  run('docker', ['compose', '--profile', 'matrix', 'up', '-d', 'synapse'])

  const versionsUrl = 'http://127.0.0.1:8008/_matrix/client/versions'
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(versionsUrl, {
        signal: AbortSignal.timeout(2_000),
      })
      if (response.ok) {
        console.log('[dev] Synapse is ready at http://localhost:8008')
        return
      }
    } catch {
      // Synapse normally needs a few seconds after the container starts.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }

  run('docker', ['compose', '--profile', 'matrix', 'logs', '--tail', '80', 'synapse'])
  throw new Error('Synapse did not become ready within 30 seconds')
}

await ensureLocalDatabase()
await ensureLocalSynapse()

console.log(
  '[dev] Starting VibeChat: Web 8001, Backend 8002, Site 8003, Admin 8005, Space Runtime 8007',
)

const turboPath = join(repositoryRoot, 'node_modules', '.bin', 'turbo')
const child = spawn(
  turboPath,
  [
    'run',
    'dev',
    '--env-mode=loose',
    ...filters.map((filter) => `--filter=${filter}`),
  ],
  {
    cwd: repositoryRoot,
    env: developmentEnvironment,
    stdio: 'inherit',
  },
)

let terminating = false
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    terminating = true
    child.kill(signal)
  })
}

child.once('error', (error) => {
  console.error('[dev] Failed to start application processes', error)
  process.exitCode = 1
})

child.once('close', (code) => {
  process.exitCode = code ?? (terminating ? 0 : 1)
})
