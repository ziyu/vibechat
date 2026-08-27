import claudeCode from "@agentos-software/claude-code";
import pi from "@agentos-software/pi";
import {
  agentOS,
  setup,
  type AgentOsLimits,
  type NetworkPermissions,
} from "@rivet-dev/agentos";
import { setupApps } from "@rivet-dev/agentos-apps";
import type {
  SpaceRuntimeDeploymentConfig,
  SpaceRuntimeExecutionPoolPolicy,
  SpaceRuntimePoolWorkload,
} from "../composition/runtime-deployment.js";
import { agentProviderSessionEnvironment } from "../composition/runtime-deployment.js";

export function createAgentOsAgentRegistry(
  deployment: SpaceRuntimeDeploymentConfig,
  options: { startEngine?: boolean } = {},
) {
  const { agentExecution } = deployment.poolPolicies;
  const startEngine = options.startEngine ?? false;
  const agentVm = agentOS({
    software: [pi, claudeCode],
    ...agentOsVmIsolation(agentExecution),
    resolveSessionEnvironment: () =>
      agentProviderSessionEnvironment(process.env),
  });
  return setup({
    ...(startEngine
      ? rivetClientCredentials()
      : commonRivetClientOptions(deployment)),
    startEngine,
    envoy: { poolName: agentExecution.className },
    use: { agentVm },
  });
}

export function createAgentOsAppBuildRegistry(
  deployment: SpaceRuntimeDeploymentConfig,
) {
  const { appBuild, releaseServing } = deployment.poolPolicies;
  const appBuildVm = agentOS({
    defaultSoftware: true,
    ...agentOsVmIsolation(appBuild),
  });
  const { appsActors } = setupApps({
    client: commonRivetClientOptions(deployment),
    appBuildPoolName: appBuild.className,
    releaseServingPoolName: releaseServing.className,
    build: agentOsAppsIsolation(appBuild),
    release: agentOsAppsIsolation(releaseServing),
  });
  return setup({
    ...commonRivetClientOptions(deployment),
    startEngine: false,
    envoy: { poolName: appBuild.className },
    use: {
      appBuildVm,
      agentOSAppsApp: appsActors.agentOSAppsApp,
    },
  });
}

export function createAgentOsReleaseServingRegistry(
  deployment: SpaceRuntimeDeploymentConfig,
) {
  const { appBuild, releaseServing } = deployment.poolPolicies;
  const { appsActors } = setupApps({
    client: commonRivetClientOptions(deployment),
    appBuildPoolName: appBuild.className,
    releaseServingPoolName: releaseServing.className,
    build: agentOsAppsIsolation(appBuild),
    release: agentOsAppsIsolation(releaseServing),
  });
  return setup({
    ...commonRivetClientOptions(deployment),
    startEngine: false,
    envoy: { poolName: releaseServing.className },
    use: {
      agentOSAppsScaler: appsActors.agentOSAppsScaler,
      agentOSAppsReplica: appsActors.agentOSAppsReplica,
    },
  });
}

export function createAgentOsPoolRegistry(
  deployment: SpaceRuntimeDeploymentConfig,
  workload: SpaceRuntimePoolWorkload,
  options: { startEngine?: boolean } = {},
) {
  switch (workload) {
    case "agentExecution":
      return createAgentOsAgentRegistry(deployment, options);
    case "appBuild":
      return createAgentOsAppBuildRegistry(deployment);
    case "releaseServing":
      return createAgentOsReleaseServingRegistry(deployment);
  }
}

function commonRivetClientOptions(
  deployment: SpaceRuntimeDeploymentConfig,
) {
  return {
    endpoint: deployment.engine.endpoint,
    ...rivetClientCredentials(),
  };
}

function rivetClientCredentials() {
  return {
    token: process.env.RIVET_TOKEN,
    namespace: process.env.RIVET_NAMESPACE,
  };
}

export type AgentOsAgentRegistry = ReturnType<
  typeof createAgentOsAgentRegistry
>;
export type AgentOsAppBuildRegistry = ReturnType<
  typeof createAgentOsAppBuildRegistry
>;

function agentOsVmIsolation(policy: SpaceRuntimeExecutionPoolPolicy) {
  return {
    sidecar: { kind: "shared" as const, pool: policy.className },
    permissions: {
      fs: "allow" as const,
      childProcess: "allow" as const,
      process: "allow" as const,
      env: "allow" as const,
      network: networkPermissions(policy),
    },
    limits: agentOsLimits(policy),
  };
}

function agentOsAppsIsolation(policy: SpaceRuntimeExecutionPoolPolicy) {
  return {
    sidecar: { kind: "shared" as const, pool: policy.className },
    network: networkPermissions(policy),
    limits: agentOsLimits(policy),
  };
}

function networkPermissions(
  policy: SpaceRuntimeExecutionPoolPolicy,
): NetworkPermissions {
  if (policy.egress.mode === "allow") return "allow";
  if (policy.egress.mode === "deny") return "deny";
  return {
    default: "deny",
    rules: policy.egress.patterns.map((pattern) => ({
      mode: "allow" as const,
      patterns: [pattern],
    })),
  };
}

function agentOsLimits(
  policy: SpaceRuntimeExecutionPoolPolicy,
): AgentOsLimits {
  return {
    resources: {
      cpuCount: policy.quota.cpuCount,
      maxProcesses: policy.quota.maxProcesses,
      maxOpenFds: policy.quota.maxOpenFds,
      maxFilesystemBytes: policy.quota.maxFilesystemBytes,
    },
  };
}
