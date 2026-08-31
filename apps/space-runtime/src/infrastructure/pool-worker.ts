import { mkdir } from "node:fs/promises";
import type { SpaceRuntimeConfig } from "../composition/runtime-config.js";
import {
  agentProviderCredentialsPresent,
  type SpaceRuntimePoolWorkload,
} from "../composition/runtime-deployment.js";
import { checkRivetEngineHealth } from "../rivet-health.js";
import { createAgentOsPoolRegistry } from "./actors.js";

export interface AgentOsPoolWorkerDependencies {
  environment: NodeJS.ProcessEnv;
  makeDirectory(path: string): Promise<void>;
  checkEngine(endpoint: string): Promise<{ ok: boolean; status: number | null }>;
  createRegistry(
    config: SpaceRuntimeConfig,
    workload: SpaceRuntimePoolWorkload,
    options: { startEngine: boolean },
  ): PoolWorkerRegistry;
}

export interface PoolWorkerRegistry {
  startAndWait(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface StartedAgentOsPoolWorker {
  workload: SpaceRuntimePoolWorkload;
  poolName: string;
  engineIdentity: string;
  registry: PoolWorkerRegistry;
}

const defaultDependencies: AgentOsPoolWorkerDependencies = {
  environment: process.env,
  makeDirectory: async (path) => {
    await mkdir(path, { recursive: true });
  },
  checkEngine: (endpoint) => checkRivetEngineHealth(endpoint),
  createRegistry: (config, workload, options) =>
    createAgentOsPoolRegistry(
      config.deployment,
      workload,
      options,
    ) as unknown as PoolWorkerRegistry,
};

export async function startAgentOsPoolWorker(
  config: SpaceRuntimeConfig,
  workload: SpaceRuntimePoolWorkload,
  dependencies: AgentOsPoolWorkerDependencies = defaultDependencies,
): Promise<StartedAgentOsPoolWorker> {
  const { engine, poolPolicies } = config.deployment;
  const startsManagedEngine = engine.ownership === "runtime";

  assertCredentialBoundary(workload, dependencies.environment);
  if (startsManagedEngine && workload !== "agentExecution") {
    throw new Error(
      "Only the Agent execution pool worker may own the development managed Engine",
    );
  }

  await dependencies.makeDirectory(config.agentOsTemporaryDirectory);
  if (startsManagedEngine) {
    await dependencies.makeDirectory(config.rivetEngineDataDirectory);
  }

  const environment = dependencies.environment;
  environment.TMPDIR = config.agentOsTemporaryDirectory;
  environment.RIVETKIT_STORAGE_PATH ??= config.rivetkitStoragePath;

  if (startsManagedEngine) {
    environment.RIVET_RUN_ENGINE = "1";
    environment.RIVET_ENGINE_DATABASE_PATH = config.rivetEngineDataDirectory;
    delete environment.RIVET_ENDPOINT;
    delete environment.AGENTOS_ENDPOINT;
  } else {
    environment.RIVET_RUN_ENGINE = "0";
    environment.RIVET_ENDPOINT = engine.endpoint;
    const health = await dependencies.checkEngine(engine.endpoint);
    if (!health.ok) {
      throw new Error(
        `Configured Rivet Engine is not healthy (${engine.publicIdentity}, status ${health.status ?? "unreachable"})`,
      );
    }
  }

  const registry = dependencies.createRegistry(config, workload, {
    startEngine: startsManagedEngine,
  });
  await registry.startAndWait();

  return {
    workload,
    poolName: poolPolicies[workload].className,
    engineIdentity: engine.publicIdentity,
    registry,
  };
}

export function parseAgentOsPoolWorkload(
  value: string | undefined,
): SpaceRuntimePoolWorkload {
  if (
    value === "agentExecution" ||
    value === "appBuild" ||
    value === "releaseServing"
  ) {
    return value;
  }
  throw new Error(
    "SPACE_RUNTIME_POOL_WORKLOAD must be agentExecution, appBuild, or releaseServing",
  );
}

function assertCredentialBoundary(
  workload: SpaceRuntimePoolWorkload,
  environment: NodeJS.ProcessEnv,
) {
  const leakedCredentials = agentProviderCredentialsPresent(environment);
  if (workload === "agentExecution") {
    if (
      environment.NODE_ENV?.trim() === "production" &&
      leakedCredentials.length === 0
    ) {
      throw new Error(
        "Production agentExecution pool worker requires an Agent provider credential",
      );
    }
    return;
  }
  if (leakedCredentials.length === 0) return;
  throw new Error(
    `${workload} pool worker must not receive Agent provider credentials: ${leakedCredentials.join(", ")}`,
  );
}
