import { fork, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { checkRivetEngineHealth } from "../rivet-health.js";
import {
  agentProviderCredentialEnvironmentVariables,
  type SpaceRuntimePoolWorkload,
} from "./runtime-deployment.js";
import type { SpaceRuntimeConfig } from "./runtime-config.js";

export interface AgentOsInfrastructureDependencies {
  environment: NodeJS.ProcessEnv;
  makeDirectory(path: string): Promise<void>;
  checkEngine(endpoint: string): Promise<{ ok: boolean; status: number | null }>;
  startManagedPoolWorkers(
    config: SpaceRuntimeConfig,
  ): Promise<ManagedAgentOsPoolWorkerGroup>;
}

export interface ManagedAgentOsPoolWorkerGroup {
  readonly children: ReadonlyMap<SpaceRuntimePoolWorkload, ChildProcess>;
  shutdown(signal?: NodeJS.Signals): Promise<void>;
}

export interface ManagedAgentOsPoolWorkerDependencies {
  environment: NodeJS.ProcessEnv;
  forkWorker(
    workload: SpaceRuntimePoolWorkload,
    environment: NodeJS.ProcessEnv,
  ): ChildProcess;
  terminateParent(): void;
  readinessTimeoutMs: number;
}

const poolWorkloads = [
  "agentExecution",
  "appBuild",
  "releaseServing",
] as const satisfies readonly SpaceRuntimePoolWorkload[];

const defaultDependencies: AgentOsInfrastructureDependencies = {
  environment: process.env,
  makeDirectory: async (path) => {
    await mkdir(path, { recursive: true });
  },
  checkEngine: (endpoint) => checkRivetEngineHealth(endpoint),
  startManagedPoolWorkers: (config) =>
    startManagedAgentOsPoolWorkers(config),
};

export async function startAgentOsInfrastructure(
  config: SpaceRuntimeConfig,
  dependencies: AgentOsInfrastructureDependencies = defaultDependencies,
) {
  const { engine } = config.deployment;
  await dependencies.makeDirectory(config.agentOsTemporaryDirectory);
  dependencies.environment.TMPDIR = config.agentOsTemporaryDirectory;
  dependencies.environment.RIVETKIT_STORAGE_PATH ??= config.rivetkitStoragePath;
  dependencies.environment.RIVET_RUN_ENGINE = "0";
  dependencies.environment.RIVET_ENDPOINT = engine.endpoint;

  if (engine.ownership === "runtime") {
    await dependencies.makeDirectory(config.rivetEngineDataDirectory);
    return dependencies.startManagedPoolWorkers(config);
  }

  const health = await dependencies.checkEngine(engine.endpoint);
  if (!health.ok) {
    throw new Error(
      `Configured Rivet Engine is not healthy (${engine.publicIdentity}, status ${health.status ?? "unreachable"})`,
    );
  }
  return undefined;
}

export async function startManagedAgentOsPoolWorkers(
  config: SpaceRuntimeConfig,
  dependencies: ManagedAgentOsPoolWorkerDependencies =
    defaultManagedPoolWorkerDependencies(),
): Promise<ManagedAgentOsPoolWorkerGroup> {
  if (config.deployment.engine.ownership !== "runtime") {
    throw new Error(
      "Managed AgentOS pool worker orchestration requires a Runtime-owned Engine",
    );
  }

  const children = new Map<SpaceRuntimePoolWorkload, ChildProcess>();
  let stopped = false;

  const shutdown = async (signal: NodeJS.Signals = "SIGTERM") => {
    if (stopped) return;
    stopped = true;
    const running = [...children.values()].filter(
      (child) => child.exitCode === null && child.signalCode === null,
    );
    const exitPromises = running.map(waitForChildExit);
    for (const child of running) child.kill(signal);
    await Promise.race([
      Promise.all(exitPromises),
      delay(5_000),
    ]);
    for (const child of running) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }
  };

  try {
    const agentWorker = dependencies.forkWorker(
      "agentExecution",
      createManagedPoolWorkerEnvironment(
        config,
        "agentExecution",
        dependencies.environment,
      ),
    );
    children.set("agentExecution", agentWorker);
    await waitForPoolWorkerReady(
      agentWorker,
      "agentExecution",
      config.deployment.pools.agentExecution,
      dependencies.readinessTimeoutMs,
    );

    await Promise.all(
      (["appBuild", "releaseServing"] as const).map(async (workload) => {
        const child = dependencies.forkWorker(
          workload,
          createManagedPoolWorkerEnvironment(
            config,
            workload,
            dependencies.environment,
          ),
        );
        children.set(workload, child);
        await waitForPoolWorkerReady(
          child,
          workload,
          config.deployment.pools[workload],
          dependencies.readinessTimeoutMs,
        );
      }),
    );
  } catch (error) {
    await shutdown();
    throw error;
  }

  const group: ManagedAgentOsPoolWorkerGroup = { children, shutdown };
  for (const [workload, child] of children) {
    if (child.exitCode !== null || child.signalCode !== null) {
      await shutdown();
      throw new Error(`${workload} pool worker exited immediately after readiness`);
    }
    child.once("exit", (code, signal) => {
      if (stopped) return;
      console.error(
        `[space-runtime] ${workload} pool worker exited unexpectedly (${signal ?? code ?? "unknown"})`,
      );
      stopped = true;
      for (const sibling of children.values()) {
        if (
          sibling !== child &&
          sibling.exitCode === null &&
          sibling.signalCode === null
        ) {
          sibling.kill("SIGTERM");
        }
      }
      dependencies.terminateParent();
    });
  }

  return group;
}

export function createManagedPoolWorkerEnvironment(
  config: SpaceRuntimeConfig,
  workload: SpaceRuntimePoolWorkload,
  baseEnvironment: NodeJS.ProcessEnv,
) {
  const environment: NodeJS.ProcessEnv = {
    ...baseEnvironment,
    SPACE_RUNTIME_POOL_WORKLOAD: workload,
    SPACE_RUNTIME_REPLICA_ID: `managed-${process.pid}-${workload}`,
    SPACE_RUNTIME_TMP_DIR: `${config.agentOsTemporaryDirectory}-${workload}`,
    RIVETKIT_STORAGE_PATH: config.rivetkitStoragePath,
    RIVET_ENGINE_DATABASE_PATH: config.rivetEngineDataDirectory,
  };

  if (workload === "agentExecution") {
    environment.SPACE_RUNTIME_ENGINE_MODE = "managed";
    environment.RIVET_RUN_ENGINE = "1";
    delete environment.RIVET_ENDPOINT;
    delete environment.AGENTOS_ENDPOINT;
  } else {
    environment.SPACE_RUNTIME_ENGINE_MODE = "external";
    environment.RIVET_RUN_ENGINE = "0";
    environment.RIVET_ENDPOINT = config.deployment.engine.endpoint;
    environment.AGENTOS_ENDPOINT = config.deployment.engine.endpoint;
    for (const name of agentProviderCredentialEnvironmentVariables) {
      delete environment[name];
    }
  }

  return environment;
}

function defaultManagedPoolWorkerDependencies(): ManagedAgentOsPoolWorkerDependencies {
  const entrypoint = fileURLToPath(
    new URL("../agentos-pool-worker.ts", import.meta.url),
  );
  return {
    environment: process.env,
    readinessTimeoutMs: 60_000,
    forkWorker: (_workload, environment) =>
      fork(entrypoint, [], {
        cwd: process.cwd(),
        env: environment,
        execArgv: ["--import", "tsx"],
        stdio: ["inherit", "inherit", "inherit", "ipc"],
      }),
    terminateParent: () => {
      process.exitCode = 1;
      process.kill(process.pid, "SIGTERM");
    },
  };
}

function waitForPoolWorkerReady(
  child: ChildProcess,
  workload: SpaceRuntimePoolWorkload,
  poolName: string,
  timeoutMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `${workload} pool worker did not become ready within ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
    timeout.unref();

    const cleanup = () => {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onMessage = (message: unknown) => {
      if (!isPoolWorkerReadyMessage(message)) return;
      if (message.workload !== workload || message.poolName !== poolName) {
        cleanup();
        reject(
          new Error(
            `${workload} pool worker reported mismatched readiness for ${message.workload}/${message.poolName}`,
          ),
        );
        return;
      }
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(
        new Error(
          `${workload} pool worker exited before readiness (${signal ?? code ?? "unknown"})`,
        ),
      );
    };

    child.on("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function isPoolWorkerReadyMessage(
  value: unknown,
): value is {
  type: "space-runtime-pool-ready";
  workload: SpaceRuntimePoolWorkload;
  poolName: string;
} {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    message.type === "space-runtime-pool-ready" &&
    poolWorkloads.includes(message.workload as SpaceRuntimePoolWorkload) &&
    typeof message.poolName === "string"
  );
}

function waitForChildExit(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, durationMs);
    timeout.unref();
  });
}
