import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  environmentForNode,
  resolveCompatibleNode,
} from './node-runtime.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nodePath = resolveCompatibleNode()
const playwrightPath = join(repositoryRoot, 'node_modules', '.bin', 'playwright')
const result = spawnSync(
  playwrightPath,
  [
    'test',
    '--config=tests/e2e/playwright.config.ts',
    ...process.argv.slice(2),
  ],
  {
    cwd: repositoryRoot,
    env: environmentForNode(nodePath, {
      ...process.env,
      DB_DIALECT: process.env.DB_DIALECT || 'sqlite',
      E2E_MATRIX_EXPECT_READY: '1',
      SQLITE_DB_PATH:
        process.env.SQLITE_DB_PATH || join(repositoryRoot, 'data', 'local.sqlite'),
    }),
    stdio: 'inherit',
  },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
