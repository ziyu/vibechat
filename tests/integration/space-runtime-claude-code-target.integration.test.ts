import { fork, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AgentOsAgentExecutionRuntime } from '../../apps/space-runtime/src/agent-runtime/agentos/execution-runtime'
import { runClaudeCodeProjectTurn } from '../../apps/space-runtime/src/adapters/claude-code/adapter'
import { claudeCodeSessionId } from '../../apps/space-runtime/src/adapters/claude-code/session'

const engineEndpoint = process.env.SPACE_RUNTIME_CLAUDE_TEST_ENGINE_ENDPOINT
const metricsEndpoint = process.env.SPACE_RUNTIME_CLAUDE_TEST_METRICS_ENDPOINT
const hasCredential = Boolean(
  process.env.ANTHROPIC_API_KEY?.trim()
  || process.env.ANTHROPIC_AUTH_TOKEN?.trim()
  || process.env.ANTHROPIC_OAUTH_TOKEN?.trim(),
)
const describeWithClaude = process.env.RUN_CLAUDE_TARGET_INTEGRATION === '1'
  && engineEndpoint
  && metricsEndpoint
  && hasCredential
  ? describe
  : describe.skip
const workerEntrypoint = join(
  process.cwd(),
  'apps/space-runtime/src/agentos-pool-worker.ts',
)
const suffix = `${process.pid}-${Date.now()}`
const poolName = `claude-dedicated-it-${suffix}`
const spaceInstanceId = `space-claude-target-${suffix}`
const workers: ChildProcess[] = []

describeWithClaude('Claude Code on a dedicated external AgentOS pool', () => {
  beforeAll(async () => {
    const worker = startWorker('initial')
    workers.push(worker)
    await waitForReady(worker)
    await waitForConnections(1)
  }, 60_000)

  afterAll(async () => {
    await stopWorkers()
  })

  it('runs a real Conversation, survives a missing pool, and restores the same Engine session for a Revision', async () => {
    const conversation = await runClaudeCodeProjectTurn({
      spaceInstanceId,
      executionPoolClass: poolName,
      request: 'Reply with exactly CLAUDE_TARGET_CONVERSATION_OK. Do not edit any file.',
      files: projectFiles(),
    })
    expect(conversation.kind).toBe('chat')
    expect(conversation.kind === 'chat' ? conversation.message : '').toContain(
      'CLAUDE_TARGET_CONVERSATION_OK',
    )

    const initial = workers[0]!
    initial.kill('SIGTERM')
    await waitForExit(initial)
    expect(await waitForConnections(0)).toBe(0)

    const replacement = startWorker('replacement')
    workers.push(replacement)
    await waitForReady(replacement)
    await waitForConnections(1)
    const restoredSessions = await new AgentOsAgentExecutionRuntime().open({
      spaceInstanceId,
      agentId: 'claude',
      poolClass: poolName,
    }).listSessions()
    expect(restoredSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: claudeCodeSessionId }),
    ]))

    const marker = `CLAUDE_TARGET_REVISION_${suffix.replaceAll('-', '_')}`
    const revision = await retry(async () => runClaudeCodeProjectTurn({
      spaceInstanceId,
      executionPoolClass: poolName,
      request: [
        'Create src/acceptance.ts without changing or deleting any existing file.',
        `Its only content must be: export const acceptanceMarker = "${marker}";`,
        'Complete the file edit and briefly report success.',
      ].join('\n'),
      files: projectFiles(),
    }), 90_000)
    expect(revision.kind).toBe('revision')
    expect(revision.kind === 'revision' ? revision.files['src/acceptance.ts'] : '').toContain(marker)
    expect(revision.usage?.totalTokens).toBeGreaterThan(0)
  }, 600_000)
})

function startWorker(label: string) {
  return fork(workerEntrypoint, [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PI_MODE: 'agentos',
      SPACE_RUNTIME_ENGINE_MODE: 'external',
      SPACE_RUNTIME_POOL_WORKLOAD: 'agentExecution',
      SPACE_RUNTIME_REPLICA_ID: `${label}-${suffix}`,
      SPACE_RUNTIME_REGION: 'target-integration',
      SPACE_AGENT_EXECUTION_POOL_CLASS: poolName,
      SPACE_APP_BUILD_POOL_CLASS: `unused-build-${suffix}`,
      SPACE_RELEASE_SERVING_POOL_CLASS: `unused-serving-${suffix}`,
      SPACE_AGENT_DEDICATED_POOL_ALLOWLIST: '',
      SPACE_AGENT_EGRESS_ALLOWLIST:
        process.env.SPACE_AGENT_EGRESS_ALLOWLIST || 'allow',
      SPACE_APP_BUILD_EGRESS_ALLOWLIST: 'deny',
      SPACE_RELEASE_EGRESS_ALLOWLIST: 'deny',
      SPACE_RUNTIME_TMP_DIR: `/tmp/vc-claude-target-${label}-${suffix}`,
      RIVET_ENDPOINT: engineEndpoint,
      AGENTOS_ENDPOINT: engineEndpoint,
      RIVET_RUN_ENGINE: '0',
    },
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
}

function projectFiles() {
  return {
    'package.json': JSON.stringify({
      name: 'claude-target-acceptance',
      version: '0.0.0',
      private: true,
      type: 'module',
      dependencies: { rivetkit: '2.3.9' },
    }, null, 2),
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
      },
      include: ['src'],
    }, null, 2),
    'src/index.ts': [
      'export default function fetch() {',
      '  return new Response("Claude target acceptance");',
      '}',
      '',
    ].join('\n'),
  }
}

function waitForReady(worker: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    const diagnostics: string[] = []
    worker.stdout?.on('data', (chunk) => diagnostics.push(String(chunk)))
    worker.stderr?.on('data', (chunk) => diagnostics.push(String(chunk)))
    const timeout = setTimeout(
      () => finish(new Error(`Claude worker did not become ready: ${diagnostics.join('').slice(-2_000)}`)),
      60_000,
    )
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      worker.off('message', onMessage)
      worker.off('error', onError)
      worker.off('exit', onExit)
      error ? reject(error) : resolve()
    }
    const onMessage = (message: unknown) => {
      const ready = message as Record<string, unknown> | null
      if (
        ready?.type === 'space-runtime-pool-ready'
        && ready.workload === 'agentExecution'
        && ready.poolName === poolName
      ) finish()
    }
    const onError = (error: Error) => finish(error)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      finish(new Error(`Claude worker exited before readiness (${signal ?? code ?? 'unknown'}): ${diagnostics.join('').slice(-2_000)}`))
    worker.on('message', onMessage)
    worker.once('error', onError)
    worker.once('exit', onExit)
  })
}

async function activeConnections() {
  const response = await fetch(metricsEndpoint!)
  const metrics = await response.text()
  if (!response.ok) throw new Error(`Metrics returned ${response.status}: ${metrics}`)
  return metrics.split('\n')
    .filter((line) => line.startsWith('envoy_connection_active{')
      && line.includes(`pool_name="${poolName}"`))
    .reduce((total, line) => total + Number(line.split(' ').at(-1) || 0), 0)
}

async function waitForConnections(expected: number) {
  let actual = -1
  for (let attempt = 0; attempt < 120; attempt += 1) {
    actual = await activeConnections()
    if (actual === expected) return actual
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Claude pool connections did not converge: expected ${expected}, received ${actual}`)
}

async function stopWorkers() {
  const running = workers.filter(
    (worker) => worker.exitCode === null && worker.signalCode === null,
  )
  for (const worker of running) worker.kill('SIGTERM')
  await Promise.all(running.map(waitForExit))
}

function waitForExit(worker: ChildProcess) {
  if (worker.exitCode !== null || worker.signalCode !== null) return Promise.resolve()
  return new Promise<void>((resolve) => worker.once('exit', () => resolve()))
}

async function retry<T>(operation: () => Promise<T>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }
  throw lastError
}
