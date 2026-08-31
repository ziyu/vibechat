import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const engineEndpoint = process.env.SPACE_RUNTIME_POOL_TEST_ENGINE_ENDPOINT;
const metricsEndpoint = process.env.SPACE_RUNTIME_POOL_TEST_METRICS_ENDPOINT;
const describeWithEngine = engineEndpoint && metricsEndpoint
  ? describe
  : describe.skip;
const workerEntrypoint = join(
  process.cwd(),
  "apps/space-runtime/src/agentos-pool-worker.ts",
);
const providerCredentialNames = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "ZAI_API_KEY",
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "XAI_API_KEY",
  "MISTRAL_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;

describeWithEngine("Space Runtime physical AgentOS pools", () => {
  const workers: ChildProcess[] = [];

  afterEach(async () => {
    const running = workers.filter(
      (worker) => worker.exitCode === null && worker.signalCode === null,
    );
    for (const worker of running) worker.kill("SIGTERM");
    await Promise.all(running.map(waitForExit));
  });

  it(
    "keeps two replicas in each pool and isolates a build worker exit",
    async () => {
      const suffix = `${process.pid}-${Date.now()}`;
      const pools = {
        agentExecution: `agent-it-${suffix}`,
        appBuild: `build-it-${suffix}`,
        releaseServing: `serving-it-${suffix}`,
      } as const;

      for (const workload of Object.keys(pools) as Array<keyof typeof pools>) {
        for (let replica = 1; replica <= 2; replica += 1) {
          const worker = startWorker(workload, replica, pools);
          workers.push(worker);
          await waitForReady(worker, workload, pools[workload]);
        }
      }

      await expectPoolConnections(pools, {
        agentExecution: 2,
        appBuild: 2,
        releaseServing: 2,
      });

      const buildWorker = workers[2];
      if (!buildWorker) throw new Error("Build worker was not started");
      buildWorker.kill("SIGTERM");
      await waitForExit(buildWorker);

      await expectPoolConnections(pools, {
        agentExecution: 2,
        appBuild: 1,
        releaseServing: 2,
      });
    },
    120_000,
  );
});

function startWorker(
  workload: "agentExecution" | "appBuild" | "releaseServing",
  replica: number,
  pools: Record<"agentExecution" | "appBuild" | "releaseServing", string>,
) {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    SPACE_RUNTIME_ENGINE_MODE: "external",
    SPACE_RUNTIME_POOL_WORKLOAD: workload,
    SPACE_RUNTIME_REPLICA_ID: `${workload}-${replica}`,
    SPACE_RUNTIME_REGION: "integration",
    SPACE_AGENT_EXECUTION_POOL_CLASS: pools.agentExecution,
    SPACE_APP_BUILD_POOL_CLASS: pools.appBuild,
    SPACE_RELEASE_SERVING_POOL_CLASS: pools.releaseServing,
    SPACE_AGENT_EGRESS_ALLOWLIST: "allow",
    SPACE_APP_BUILD_EGRESS_ALLOWLIST: "allow",
    SPACE_RELEASE_EGRESS_ALLOWLIST: "allow",
    SPACE_RUNTIME_TMP_DIR: `/tmp/vc-pool-it-${workload}-${replica}-${process.pid}`,
    RIVET_ENDPOINT: engineEndpoint,
    AGENTOS_ENDPOINT: engineEndpoint,
    RIVET_RUN_ENGINE: "0",
  };
  if (workload !== "agentExecution") {
    for (const name of providerCredentialNames) delete environment[name];
  }
  return fork(workerEntrypoint, [], {
    cwd: process.cwd(),
    env: environment,
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
}

function waitForReady(
  worker: ChildProcess,
  workload: string,
  poolName: string,
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(new Error(`${workload} did not become ready`)),
      60_000,
    );
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
      error ? reject(error) : resolve();
    };
    const onMessage = (message: unknown) => {
      const ready = message as Record<string, unknown> | null;
      if (
        ready?.type === "space-runtime-pool-ready" &&
        ready.workload === workload &&
        ready.poolName === poolName
      ) {
        finish();
      }
    };
    const onError = (error: Error) => finish(error);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      finish(
        new Error(
          `${workload} exited before readiness (${signal ?? code ?? "unknown"})`,
        ),
      );
    worker.on("message", onMessage);
    worker.once("error", onError);
    worker.once("exit", onExit);
  });
}

async function expectPoolConnections(
  pools: Record<"agentExecution" | "appBuild" | "releaseServing", string>,
  expected: Record<"agentExecution" | "appBuild" | "releaseServing", number>,
) {
  let lastMetrics = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    lastMetrics = await fetch(metricsEndpoint!).then((response) => {
      if (!response.ok) throw new Error(`Metrics returned ${response.status}`);
      return response.text();
    });
    const matches = Object.entries(pools).every(([workload, poolName]) =>
      activeConnections(lastMetrics, poolName) ===
        expected[workload as keyof typeof expected],
    );
    if (matches) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Pool connections did not converge: ${Object.values(pools)
      .map((poolName) => `${poolName}=${activeConnections(lastMetrics, poolName)}`)
      .join(", ")}`,
  );
}

function activeConnections(metrics: string, poolName: string) {
  const line = metrics
    .split("\n")
    .find(
      (entry) =>
        entry.startsWith("envoy_connection_active{") &&
        entry.includes(`pool_name="${poolName}"`),
    );
  return Number(line?.split(" ").at(-1) ?? 0);
}

function waitForExit(worker: ChildProcess) {
  if (worker.exitCode !== null || worker.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => worker.once("exit", () => resolve()));
}
