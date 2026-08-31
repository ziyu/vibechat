import { fork, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const engineEndpoint = process.env.SPACE_RUNTIME_POOL_TEST_ENGINE_ENDPOINT
const metricsEndpoint = process.env.SPACE_RUNTIME_POOL_TEST_METRICS_ENDPOINT
const describeWithEngine = engineEndpoint && metricsEndpoint ? describe : describe.skip
const workerEntrypoint = join(
  process.cwd(),
  'apps/space-runtime/src/agentos-pool-worker.ts',
)

describeWithEngine('Space Runtime dedicated Agent pool recovery', () => {
  const workers: ChildProcess[] = []

  afterEach(async () => {
    await stopWorkers(workers)
  })

  it('reports a dedicated pool missing, restores its replicas, and does not change regional pools', async () => {
    const suffix = `${process.pid}-${Date.now()}`
    const dedicatedPool = `dedicated-agent-it-${suffix}`
    const regionalPools = {
      agentExecution: `regional-agent-it-${suffix}`,
      appBuild: `regional-build-it-${suffix}`,
      releaseServing: `regional-serving-it-${suffix}`,
    }

    expect(await activeConnections(dedicatedPool)).toBe(0)
    const regionalAgent = startWorker(regionalPools.agentExecution, regionalPools)
    workers.push(regionalAgent)
    await waitForReady(regionalAgent, regionalPools.agentExecution)
    expect(await waitForConnections(regionalPools.agentExecution, 1)).toBe(1)

    const first = startWorker(dedicatedPool, regionalPools)
    const second = startWorker(dedicatedPool, regionalPools)
    workers.push(first, second)
    await Promise.all([
      waitForReady(first, dedicatedPool),
      waitForReady(second, dedicatedPool),
    ])
    expect(await waitForConnections(dedicatedPool, 2)).toBe(2)

    first.kill('SIGTERM')
    second.kill('SIGTERM')
    await Promise.all([waitForExit(first), waitForExit(second)])
    expect(await waitForConnections(dedicatedPool, 0)).toBe(0)
    expect(await activeConnections(regionalPools.agentExecution)).toBe(1)

    const replacementA = startWorker(dedicatedPool, regionalPools)
    const replacementB = startWorker(dedicatedPool, regionalPools)
    workers.push(replacementA, replacementB)
    await Promise.all([
      waitForReady(replacementA, dedicatedPool),
      waitForReady(replacementB, dedicatedPool),
    ])
    expect(await waitForConnections(dedicatedPool, 2)).toBe(2)
    expect(await activeConnections(regionalPools.agentExecution)).toBe(1)
  }, 120_000)
})

function startWorker(
  poolName: string,
  regionalPools: Record<'agentExecution' | 'appBuild' | 'releaseServing', string>,
) {
  return fork(workerEntrypoint, [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PI_MODE: 'agentos',
      SPACE_RUNTIME_ENGINE_MODE: 'external',
      SPACE_RUNTIME_POOL_WORKLOAD: 'agentExecution',
      SPACE_RUNTIME_REPLICA_ID: `${poolName}-${crypto.randomUUID()}`,
      SPACE_RUNTIME_REGION: 'integration',
      SPACE_AGENT_EXECUTION_POOL_CLASS: poolName,
      SPACE_APP_BUILD_POOL_CLASS: regionalPools.appBuild,
      SPACE_RELEASE_SERVING_POOL_CLASS: regionalPools.releaseServing,
      SPACE_AGENT_DEDICATED_POOL_ALLOWLIST: '',
      SPACE_AGENT_EGRESS_ALLOWLIST: 'deny',
      SPACE_APP_BUILD_EGRESS_ALLOWLIST: 'deny',
      SPACE_RELEASE_EGRESS_ALLOWLIST: 'deny',
      SPACE_RUNTIME_TMP_DIR: `/tmp/vc-dedicated-pool-it-${process.pid}-${crypto.randomUUID()}`,
      RIVET_ENDPOINT: engineEndpoint,
      AGENTOS_ENDPOINT: engineEndpoint,
      RIVET_RUN_ENGINE: '0',
    },
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
}

function waitForReady(worker: ChildProcess, poolName: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(new Error(`${poolName} did not become ready`)),
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
      finish(new Error(`${poolName} exited before readiness (${signal ?? code ?? 'unknown'})`))
    worker.on('message', onMessage)
    worker.once('error', onError)
    worker.once('exit', onExit)
  })
}

async function activeConnections(poolName: string) {
  const response = await fetch(metricsEndpoint!)
  const metrics = await response.text()
  if (!response.ok) throw new Error(`Metrics returned ${response.status}: ${metrics}`)
  return metrics.split('\n')
    .filter((line) => line.startsWith('envoy_connection_active{')
      && line.includes(`pool_name="${poolName}"`))
    .reduce((total, line) => total + Number(line.split(' ').at(-1) || 0), 0)
}

async function waitForConnections(poolName: string, expected: number) {
  let actual = -1
  for (let attempt = 0; attempt < 80; attempt += 1) {
    actual = await activeConnections(poolName)
    if (actual === expected) return actual
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${poolName} connections did not converge: expected ${expected}, received ${actual}`)
}

async function stopWorkers(workers: ChildProcess[]) {
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
