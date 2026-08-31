import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const requiredVariables = [
  'A34_WEB_ORIGIN',
  'A34_BACKEND_ORIGIN',
  'A34_RUNTIME_ORIGINS',
  'A34_ENGINE_ENDPOINT',
  'A34_ENGINE_METRICS_ENDPOINT',
  'A34_DEDICATED_AGENT_POOL',
  'A34_SPACE_INSTANCE_ID',
  'A34_MATRIX_HOMESERVER_URL',
  'A34_MATRIX_ROOM_ID',
  'A34_MATRIX_ACCESS_TOKEN',
  'A34_USER_A_EMAIL',
  'A34_USER_A_PASSWORD',
  'A34_USER_B_EMAIL',
  'A34_USER_B_PASSWORD',
  'A34_D1_DATABASE_ID',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'R2_ACCESS_KEY_ID',
  'R2_ACCESS_KEY_SECRET',
  'R2_BUCKET',
  'SPACE_RUNTIME_INTERNAL_TOKEN',
  'SPACE_AGENT_EGRESS_ALLOWLIST',
]

const missing = requiredVariables.filter((name) => !process.env[name]?.trim())
const hasAnthropicCredential = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_OAUTH_TOKEN',
].some((name) => process.env[name]?.trim())
if (!hasAnthropicCredential) {
  missing.push('ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_OAUTH_TOKEN')
}
if (missing.length > 0) {
  console.error(`A3/A4 target acceptance is missing: ${missing.join(', ')}`)
  process.exit(2)
}
if (['allow', 'deny'].includes(process.env.SPACE_AGENT_EGRESS_ALLOWLIST.trim())) {
  console.error(
    'A3/A4 target acceptance requires a non-empty bounded SPACE_AGENT_EGRESS_ALLOWLIST, not allow or deny',
  )
  process.exit(2)
}

const runtimeOrigins = process.env.A34_RUNTIME_ORIGINS.split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map(targetOrigin)
if (runtimeOrigins.length !== 2 || new Set(runtimeOrigins).size !== 2) {
  console.error('A34_RUNTIME_ORIGINS must contain exactly two distinct Runtime origins')
  process.exit(2)
}

const environment = {
  ...process.env,
  RUN_A3_A4_TARGET_ACCEPTANCE: '1',
  RUN_CLAUDE_TARGET_INTEGRATION: '1',
  E2E_BASE_URL: process.env.A34_WEB_ORIGIN,
  E2E_MATRIX_EXPECT_READY: '1',
  E2E_SPACE_AGENT_EXPECT_READY: '1',
  SPACE_RUNTIME_POOL_TEST_ENGINE_ENDPOINT: process.env.A34_ENGINE_ENDPOINT,
  SPACE_RUNTIME_POOL_TEST_METRICS_ENDPOINT: process.env.A34_ENGINE_METRICS_ENDPOINT,
  SPACE_RUNTIME_CLAUDE_TEST_ENGINE_ENDPOINT: process.env.A34_ENGINE_ENDPOINT,
  SPACE_RUNTIME_CLAUDE_TEST_METRICS_ENDPOINT: process.env.A34_ENGINE_METRICS_ENDPOINT,
  RIVET_ENDPOINT: process.env.A34_ENGINE_ENDPOINT,
  AGENTOS_ENDPOINT: process.env.A34_ENGINE_ENDPOINT,
}

await run(process.execPath, [
  resolve('node_modules/vitest/vitest.mjs'),
  'run',
  'tests/integration/a3-a4-target-environment.integration.test.ts',
  'tests/integration/space-runtime-dedicated-agent-pool.integration.test.ts',
  'tests/integration/space-runtime-claude-code-target.integration.test.ts',
], environment)
await run(process.execPath, [
  resolve('node_modules/@playwright/test/cli.js'),
  'test',
  '--config=tests/e2e/playwright.config.ts',
  'a3-a4-target-acceptance.spec.ts',
], environment)

function run(command, args, environment) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolveRun()
      reject(new Error(
        `${command} ${args.join(' ')} failed with ${signal || code || 'unknown status'}`,
      ))
    })
  })
}

function targetOrigin(value) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Target origin must use HTTP(S): ${value}`)
  }
  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw new Error(`Target origin must not contain credentials, paths, query, or fragments: ${value}`)
  }
  return parsed.origin
}
