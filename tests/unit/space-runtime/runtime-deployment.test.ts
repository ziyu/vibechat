import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { agentOS } from "@rivet-dev/agentos";
import { setupApps } from "@rivet-dev/agentos-apps";
import {
  createManagedPoolWorkerEnvironment,
  startAgentOsInfrastructure,
  startManagedAgentOsPoolWorkers,
} from "../../../apps/space-runtime/src/composition/agentos-infrastructure";
import { createSpaceRuntimeConfig } from "../../../apps/space-runtime/src/composition/runtime-config";
import {
  parseSpaceRuntimeDeploymentConfig,
  resolveAgentExecutionPoolClass,
} from "../../../apps/space-runtime/src/composition/runtime-deployment";
import {
  createAgentOsAgentRegistry,
  createAgentOsAppBuildRegistry,
  createAgentOsReleaseServingRegistry,
} from "../../../apps/space-runtime/src/infrastructure/actors";
import {
  parseAgentOsPoolWorkload,
  startAgentOsPoolWorker,
} from "../../../apps/space-runtime/src/infrastructure/pool-worker";

vi.mock("@rivet-dev/agentos", async (importOriginal) => {
  const original = await importOriginal<typeof import("@rivet-dev/agentos")>();
  return {
    ...original,
    agentOS: vi.fn(original.agentOS),
  };
});

vi.mock("@rivet-dev/agentos-apps", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@rivet-dev/agentos-apps")>();
  return {
    ...original,
    setupApps: vi.fn(original.setupApps),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Space Runtime deployment configuration", () => {
  it("keeps non-production standalone Runtime in managed mode", () => {
    expect(parseSpaceRuntimeDeploymentConfig({}, 42)).toMatchObject({
      engine: {
        mode: "managed",
        ownership: "runtime",
        endpoint: "http://127.0.0.1:6420",
        endpointSource: "managed-default",
        publicIdentity: "http://127.0.0.1:6420",
      },
      replica: { id: "local-42", region: "local" },
      pools: {
        agentExecution: "agent-execution",
        appBuild: "app-build",
        releaseServing: "release-serving",
      },
      poolRoutingEnforced: true,
      poolPolicies: {
        agentExecution: {
          className: "agent-execution",
          credentialScope: "agent-provider",
          egress: { mode: "allow", source: "development-default" },
        },
        appBuild: {
          className: "app-build",
          credentialScope: "build-without-provider-credentials",
          egress: { mode: "allow", source: "development-default" },
        },
        releaseServing: {
          className: "release-serving",
          credentialScope: "app-scoped-serving-capability",
          egress: { mode: "allow", source: "development-default" },
        },
      },
    });
  });

  it("requires explicit external production identity and distinct pools", () => {
    expect(
      parseSpaceRuntimeDeploymentConfig({
        NODE_ENV: "production",
        PI_MODE: "agentos",
        SPACE_RUNTIME_ENGINE_MODE: "external",
        SPACE_RUNTIME_POOL_WORKLOAD: "agentExecution",
        RIVET_ENDPOINT: "https://engine.cn-east.internal/agentos/",
        SPACE_RUNTIME_REPLICA_ID: "runtime-a",
        SPACE_RUNTIME_REGION: "cn-east",
        SPACE_AGENT_EXECUTION_POOL_CLASS: "agents",
        SPACE_APP_BUILD_POOL_CLASS: "builds",
        SPACE_RELEASE_SERVING_POOL_CLASS: "serving",
        SPACE_AGENT_EGRESS_ALLOWLIST: "https://api.example/**",
        SPACE_APP_BUILD_EGRESS_ALLOWLIST: "https://registry.example/**",
        SPACE_RELEASE_EGRESS_ALLOWLIST: "deny",
        OPENAI_API_KEY: "worker-only",
      }),
    ).toMatchObject({
      engine: {
        mode: "external",
        ownership: "external",
        endpoint: "https://engine.cn-east.internal/agentos",
        endpointSource: "RIVET_ENDPOINT",
        publicIdentity: "https://engine.cn-east.internal/agentos",
      },
      replica: { id: "runtime-a", region: "cn-east" },
      pools: {
        agentExecution: "agents",
        appBuild: "builds",
        releaseServing: "serving",
      },
      poolRoutingEnforced: true,
      poolPolicies: {
        agentExecution: {
          className: "agents",
          egress: {
            mode: "allowlist",
            patterns: ["https://api.example/**"],
            source: "SPACE_AGENT_EGRESS_ALLOWLIST",
          },
        },
        appBuild: {
          className: "builds",
          egress: {
            mode: "allowlist",
            patterns: ["https://registry.example/**"],
          },
        },
        releaseServing: {
          className: "serving",
          egress: { mode: "deny", patterns: [] },
        },
      },
    });
  });

  it("fails closed for implicit or incomplete production topology", () => {
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        NODE_ENV: "production",
        PI_MODE: "agentos",
        RIVET_ENDPOINT: "https://engine.internal",
      }),
    ).toThrow("SPACE_RUNTIME_ENGINE_MODE=external");
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        NODE_ENV: "production",
        PI_MODE: "agentos",
        SPACE_RUNTIME_ENGINE_MODE: "external",
      }),
    ).toThrow("requires RIVET_ENDPOINT or AGENTOS_ENDPOINT");
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        NODE_ENV: "production",
        PI_MODE: "agentos",
        SPACE_RUNTIME_ENGINE_MODE: "external",
        RIVET_ENDPOINT: "https://engine.internal",
      }),
    ).toThrow("SPACE_RUNTIME_REGION");
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        NODE_ENV: "production",
        PI_MODE: "host",
        SPACE_RUNTIME_ENGINE_MODE: "external",
        RIVET_ENDPOINT: "https://engine.internal",
      }),
    ).toThrow("PI_MODE=agentos");
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        NODE_ENV: "production",
        PI_MODE: "agentos",
        SPACE_RUNTIME_ENGINE_MODE: "external",
        RIVET_ENDPOINT: "https://engine.internal",
        OPENAI_API_KEY: "must-be-worker-scoped",
      }),
    ).toThrow("control must not receive Agent provider credentials");
  });

  it("rejects unsafe endpoints and collapsed external pool boundaries", () => {
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        SPACE_RUNTIME_ENGINE_MODE: "external",
        RIVET_ENDPOINT: "https://user:secret@engine.internal?token=secret",
      }),
    ).toThrow("must not contain credentials");
    expect(() =>
      parseSpaceRuntimeDeploymentConfig({
        SPACE_RUNTIME_ENGINE_MODE: "external",
        RIVET_ENDPOINT: "https://engine.internal",
        SPACE_AGENT_EXECUTION_POOL_CLASS: "shared",
        SPACE_APP_BUILD_POOL_CLASS: "shared",
      }),
    ).toThrow("requires distinct Agent");
  });

  it("applies independent egress and quota policies to Engine and sidecar pools", async () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "worker-anthropic-token");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://anthropic.internal");
    vi.stubEnv("OPENAI_API_KEY", "worker-openai-key");
    const deployment = parseSpaceRuntimeDeploymentConfig({
      SPACE_RUNTIME_ENGINE_MODE: "external",
      RIVET_ENDPOINT: "https://engine.internal",
      SPACE_AGENT_EXECUTION_POOL_CLASS: "agents",
      SPACE_APP_BUILD_POOL_CLASS: "builds",
      SPACE_RELEASE_SERVING_POOL_CLASS: "serving",
      SPACE_AGENT_EGRESS_ALLOWLIST: "https://api.example/**",
      SPACE_APP_BUILD_EGRESS_ALLOWLIST: "https://registry.example/**",
      SPACE_RELEASE_EGRESS_ALLOWLIST: "deny",
      SPACE_AGENT_VM_MAX_PROCESSES: "33",
      SPACE_APP_BUILD_VM_MAX_PROCESSES: "44",
      SPACE_RELEASE_VM_MAX_PROCESSES: "11",
    });
    const agentRegistry = createAgentOsAgentRegistry(deployment);
    const appBuildRegistry = createAgentOsAppBuildRegistry(deployment);
    const releaseServingRegistry =
      createAgentOsReleaseServingRegistry(deployment);
    const agentOsCalls = vi.mocked(agentOS).mock.calls.slice(-2);
    const agentVmOptions = agentOsCalls[0]?.[0];
    const appBuildVmOptions = agentOsCalls[1]?.[0];
    const appsOptions = vi.mocked(setupApps).mock.calls.at(-1)?.[0];
    const agentConfig = agentRegistry.parseConfig();
    const buildConfig = appBuildRegistry.parseConfig();
    const servingConfig = releaseServingRegistry.parseConfig();

    expect(agentConfig.envoy.poolName).toBe("agents");
    expect(buildConfig.envoy.poolName).toBe("builds");
    expect(servingConfig.envoy.poolName).toBe("serving");
    expect(Object.keys(agentConfig.use)).toEqual(["agentVm"]);
    expect(Object.keys(buildConfig.use).sort()).toEqual([
      "agentOSAppsApp",
      "appBuildVm",
    ]);
    expect(Object.keys(servingConfig.use).sort()).toEqual([
      "agentOSAppsReplica",
      "agentOSAppsScaler",
    ]);
    expect(agentVmOptions?.sidecar).toEqual({
      kind: "shared",
      pool: "agents",
    });
    expect(agentVmOptions?.limits?.resources?.maxProcesses).toBe(33);
    expect(agentVmOptions?.resolveSessionEnvironment).toEqual(
      expect.any(Function),
    );
    await expect(Promise.resolve(
      agentVmOptions?.resolveSessionEnvironment?.(
        {} as never,
        { agent: "pi" },
      ),
    )).resolves.toMatchObject({
      ANTHROPIC_API_KEY: "worker-anthropic-token",
      ANTHROPIC_AUTH_TOKEN: "worker-anthropic-token",
      ANTHROPIC_BASE_URL: "https://anthropic.internal",
      OPENAI_API_KEY: "worker-openai-key",
    });
    expect(appBuildVmOptions?.sidecar).toEqual({
      kind: "shared",
      pool: "builds",
    });
    expect(appBuildVmOptions?.limits?.resources?.maxProcesses).toBe(44);
    expect(appsOptions?.build?.limits?.resources?.maxProcesses).toBe(44);
    expect(appsOptions?.release?.sidecar).toEqual({
      kind: "shared",
      pool: "serving",
    });
    expect(appsOptions?.release?.limits?.resources?.maxProcesses).toBe(11);
    expect(appsOptions?.release?.network).toBe("deny");
  });

  it("routes only region-compatible Definitions to allowlisted dedicated pools", () => {
    const deployment = parseSpaceRuntimeDeploymentConfig({
      SPACE_RUNTIME_ENGINE_MODE: "external",
      RIVET_ENDPOINT: "https://engine.internal",
      SPACE_RUNTIME_REGION: "cn-east",
      SPACE_AGENT_EXECUTION_POOL_CLASS: "agents-regional",
      SPACE_APP_BUILD_POOL_CLASS: "builds",
      SPACE_RELEASE_SERVING_POOL_CLASS: "serving",
      SPACE_AGENT_DEDICATED_POOL_ALLOWLIST: "tenant-a,tenant-b,tenant-a",
    });

    expect(deployment.dedicatedAgentPools).toEqual(["tenant-a", "tenant-b"]);
    expect(resolveAgentExecutionPoolClass(deployment, {
      dataRegionPolicy: { mode: "required", regions: ["cn-east"] },
      executionPoolPolicy: { mode: "regional_shared", poolClass: null },
    })).toBe("agents-regional");
    expect(resolveAgentExecutionPoolClass(deployment, {
      dataRegionPolicy: { mode: "allowlist", regions: ["cn-east", "cn-north"] },
      executionPoolPolicy: { mode: "dedicated", poolClass: "tenant-a" },
    })).toBe("tenant-a");
    expect(() => resolveAgentExecutionPoolClass(deployment, {
      dataRegionPolicy: { mode: "required", regions: ["eu-west"] },
      executionPoolPolicy: { mode: "regional_shared", poolClass: null },
    })).toThrow("not allowed in Runtime region cn-east");
    expect(() => resolveAgentExecutionPoolClass(deployment, {
      dataRegionPolicy: { mode: "any", regions: [] },
      executionPoolPolicy: { mode: "dedicated", poolClass: "tenant-denied" },
    })).toThrow("not allowed by this Runtime deployment");
    expect(() => parseSpaceRuntimeDeploymentConfig({
      SPACE_AGENT_DEDICATED_POOL_ALLOWLIST: "agent-execution",
    })).toThrow("must be distinct from regional Agent");
  });
});

describe("Space Runtime AgentOS infrastructure startup", () => {
  it("starts standalone managed pool processes with a private data directory", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "managed",
      RIVETKIT_STORAGE_PATH: "/tmp/runtime-managed",
      SPACE_RUNTIME_TMP_DIR: "/tmp/runtime-managed-work",
    });
    const environment: NodeJS.ProcessEnv = {};
    const makeDirectory = vi.fn(async () => undefined);
    const managedWorkers = {
      children: new Map(),
      shutdown: vi.fn(async () => undefined),
    };
    const startManagedPoolWorkers = vi.fn(async () => managedWorkers);
    const checkEngine = vi.fn();

    await startAgentOsInfrastructure(config, {
      environment,
      makeDirectory,
      startManagedPoolWorkers,
      checkEngine,
    });

    expect(makeDirectory).toHaveBeenNthCalledWith(1, "/tmp/runtime-managed-work");
    expect(makeDirectory).toHaveBeenNthCalledWith(
      2,
      "/tmp/runtime-managed/managed-engine/db",
    );
    expect(checkEngine).not.toHaveBeenCalled();
    expect(startManagedPoolWorkers).toHaveBeenCalledOnce();
    expect(environment).toMatchObject({
      RIVET_ENDPOINT: "http://127.0.0.1:6420",
      RIVET_RUN_ENGINE: "0",
      RIVETKIT_STORAGE_PATH: "/tmp/runtime-managed",
      TMPDIR: "/tmp/runtime-managed-work",
    });
  });

  it("preflights external Engine and never creates a local Engine database", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "external",
      RIVET_ENDPOINT: "https://engine.internal",
      SPACE_RUNTIME_TMP_DIR: "/tmp/runtime-external-work",
    });
    const environment: NodeJS.ProcessEnv = {};
    const makeDirectory = vi.fn(async () => undefined);
    const startManagedPoolWorkers = vi.fn();
    const checkEngine = vi.fn(async () => ({ ok: true, status: 200 }));

    await startAgentOsInfrastructure(config, {
      environment,
      makeDirectory,
      startManagedPoolWorkers,
      checkEngine,
    });

    expect(makeDirectory).toHaveBeenCalledOnce();
    expect(checkEngine).toHaveBeenCalledWith("https://engine.internal");
    expect(startManagedPoolWorkers).not.toHaveBeenCalled();
    expect(environment).toMatchObject({
      RIVET_ENDPOINT: "https://engine.internal",
      RIVET_RUN_ENGINE: "0",
      TMPDIR: "/tmp/runtime-external-work",
    });
  });

  it("does not start Runtime or pool workers when external Engine is unhealthy", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "external",
      RIVET_ENDPOINT: "https://engine.internal",
    });
    const startManagedPoolWorkers = vi.fn();

    await expect(
      startAgentOsInfrastructure(config, {
        environment: {},
        makeDirectory: vi.fn(async () => undefined),
        startManagedPoolWorkers,
        checkEngine: vi.fn(async () => ({ ok: false, status: 503 })),
      }),
    ).rejects.toThrow("Configured Rivet Engine is not healthy");
    expect(startManagedPoolWorkers).not.toHaveBeenCalled();
  });
});

describe("Space Runtime AgentOS pool worker", () => {
  it("starts exactly one external Registry after Engine preflight", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "external",
      RIVET_ENDPOINT: "https://engine.internal",
    });
    const registry = {
      startAndWait: vi.fn(async () => undefined),
      shutdown: vi.fn(async () => undefined),
    };
    const createRegistry = vi.fn(() => registry);
    const environment: NodeJS.ProcessEnv = {};
    const checkEngine = vi.fn(async () => ({ ok: true, status: 200 }));

    await expect(
      startAgentOsPoolWorker(config, "appBuild", {
        environment,
        makeDirectory: vi.fn(async () => undefined),
        checkEngine,
        createRegistry,
      }),
    ).resolves.toMatchObject({
      workload: "appBuild",
      poolName: "app-build",
      engineIdentity: "https://engine.internal",
    });

    expect(checkEngine).toHaveBeenCalledWith("https://engine.internal");
    expect(createRegistry).toHaveBeenCalledOnce();
    expect(createRegistry).toHaveBeenCalledWith(config, "appBuild", {
      startEngine: false,
    });
    expect(registry.startAndWait).toHaveBeenCalledOnce();
    expect(environment).toMatchObject({
      RIVET_ENDPOINT: "https://engine.internal",
      RIVET_RUN_ENGINE: "0",
    });
  });

  it("fails closed when build or serving receives Agent credentials", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "external",
      RIVET_ENDPOINT: "https://engine.internal",
    });
    const createRegistry = vi.fn();
    await expect(
      startAgentOsPoolWorker(config, "releaseServing", {
        environment: { OPENAI_API_KEY: "must-not-leak" },
        makeDirectory: vi.fn(async () => undefined),
        checkEngine: vi.fn(),
        createRegistry,
      }),
    ).rejects.toThrow(
      "releaseServing pool worker must not receive Agent provider credentials: OPENAI_API_KEY",
    );
    expect(createRegistry).not.toHaveBeenCalled();
  });

  it("fails closed when a production Agent worker has no provider credential", async () => {
    const config = createSpaceRuntimeConfig({
      NODE_ENV: "production",
      PI_MODE: "agentos",
      SPACE_RUNTIME_ENGINE_MODE: "external",
      SPACE_RUNTIME_POOL_WORKLOAD: "agentExecution",
      SPACE_RUNTIME_REPLICA_ID: "agent-worker-a",
      SPACE_RUNTIME_REGION: "cn-east",
      RIVET_ENDPOINT: "https://engine.internal",
      SPACE_AGENT_EGRESS_ALLOWLIST: "allow",
      SPACE_APP_BUILD_EGRESS_ALLOWLIST: "deny",
      SPACE_RELEASE_EGRESS_ALLOWLIST: "deny",
    });
    const createRegistry = vi.fn();

    await expect(
      startAgentOsPoolWorker(config, "agentExecution", {
        environment: { NODE_ENV: "production" },
        makeDirectory: vi.fn(async () => undefined),
        checkEngine: vi.fn(),
        createRegistry,
      }),
    ).rejects.toThrow(
      "Production agentExecution pool worker requires an Agent provider credential",
    );
    expect(createRegistry).not.toHaveBeenCalled();
  });

  it("lets only the Agent worker own a managed development Engine", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "managed",
      RIVETKIT_STORAGE_PATH: "/tmp/managed-worker",
      SPACE_RUNTIME_TMP_DIR: "/tmp/managed-worker-tmp",
      RIVET_ENDPOINT: undefined,
      AGENTOS_ENDPOINT: undefined,
    });
    const environment: NodeJS.ProcessEnv = {
      RIVET_ENDPOINT: "http://stale.invalid",
      AGENTOS_ENDPOINT: "http://stale.invalid",
    };
    const registry = {
      startAndWait: vi.fn(async () => undefined),
      shutdown: vi.fn(async () => undefined),
    };
    const makeDirectory = vi.fn(async () => undefined);
    const createRegistry = vi.fn(() => registry);

    await startAgentOsPoolWorker(config, "agentExecution", {
      environment,
      makeDirectory,
      checkEngine: vi.fn(),
      createRegistry,
    });

    expect(makeDirectory).toHaveBeenNthCalledWith(1, "/tmp/managed-worker-tmp");
    expect(makeDirectory).toHaveBeenNthCalledWith(
      2,
      "/tmp/managed-worker/managed-engine/db",
    );
    expect(createRegistry).toHaveBeenCalledWith(config, "agentExecution", {
      startEngine: true,
    });
    expect(environment.RIVET_RUN_ENGINE).toBe("1");
    expect(environment.RIVET_ENDPOINT).toBeUndefined();
    expect(environment.AGENTOS_ENDPOINT).toBeUndefined();

    await expect(
      startAgentOsPoolWorker(config, "appBuild", {
        environment: {},
        makeDirectory,
        checkEngine: vi.fn(),
        createRegistry,
      }),
    ).rejects.toThrow("Only the Agent execution pool worker");
  });

  it("requires an explicit supported workload role", () => {
    expect(parseAgentOsPoolWorkload("agentExecution")).toBe("agentExecution");
    expect(() => parseAgentOsPoolWorkload("shared")).toThrow(
      "SPACE_RUNTIME_POOL_WORKLOAD",
    );
  });
});

describe("Standalone managed AgentOS pool orchestration", () => {
  it("starts Agent first, isolates non-Agent credentials, and fails closed on worker exit", async () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "managed",
      OPENAI_API_KEY: "agent-only",
    });
    const forkOrder: string[] = [];
    const workerEnvironments = new Map<string, NodeJS.ProcessEnv>();
    const workers = new Map<string, ChildProcess>();
    const terminateParent = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const group = await startManagedAgentOsPoolWorkers(config, {
        environment: { OPENAI_API_KEY: "agent-only" },
        readinessTimeoutMs: 1_000,
        terminateParent,
        forkWorker: (workload, environment) => {
          forkOrder.push(workload);
          workerEnvironments.set(workload, environment);
          const worker = createFakeChildProcess();
          workers.set(workload, worker);
          queueMicrotask(() => {
            worker.emit("message", {
              type: "space-runtime-pool-ready",
              workload,
              poolName: config.deployment.pools[workload],
            });
          });
          return worker;
        },
      });

      expect(forkOrder[0]).toBe("agentExecution");
      expect(new Set(forkOrder.slice(1))).toEqual(
        new Set(["appBuild", "releaseServing"]),
      );
      expect(workerEnvironments.get("agentExecution")?.OPENAI_API_KEY).toBe(
        "agent-only",
      );
      expect(workerEnvironments.get("agentExecution")?.RIVET_ENDPOINT).toBeUndefined();
      expect(workerEnvironments.get("appBuild")?.OPENAI_API_KEY).toBeUndefined();
      expect(workerEnvironments.get("releaseServing")?.OPENAI_API_KEY).toBeUndefined();
      expect(workerEnvironments.get("appBuild")?.SPACE_RUNTIME_ENGINE_MODE).toBe(
        "external",
      );

      const buildWorker = workers.get("appBuild")!;
      buildWorker.emit("exit", 1, null);
      expect(terminateParent).toHaveBeenCalledOnce();
      expect(workers.get("agentExecution")?.kill).toHaveBeenCalledWith(
        "SIGTERM",
      );

      await group.shutdown();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("creates managed/external child environments without mutating the parent", () => {
    const config = createSpaceRuntimeConfig({
      SPACE_RUNTIME_ENGINE_MODE: "managed",
    });
    const parent = { OPENAI_API_KEY: "agent-only" };
    const serving = createManagedPoolWorkerEnvironment(
      config,
      "releaseServing",
      parent,
    );
    expect(parent).toEqual({ OPENAI_API_KEY: "agent-only" });
    expect(serving.OPENAI_API_KEY).toBeUndefined();
    expect(serving.RIVET_ENDPOINT).toBe("http://127.0.0.1:6420");
  });
});

function createFakeChildProcess() {
  const worker = new EventEmitter() as ChildProcess;
  Object.assign(worker, {
    exitCode: null,
    signalCode: null,
    kill: vi.fn((signal: NodeJS.Signals) => {
      Object.defineProperty(worker, "signalCode", {
        configurable: true,
        value: signal,
      });
      worker.emit("exit", null, signal);
      return true;
    }),
  });
  return worker;
}
