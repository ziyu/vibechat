export type SpaceRuntimeEngineMode = "managed" | "external";

export type SpaceRuntimeEngineOwnership =
  | "runtime"
  | "development-launcher"
  | "external";

export interface SpaceRuntimeExecutionPools {
  agentExecution: string;
  appBuild: string;
  releaseServing: string;
}

export type SpaceRuntimePoolWorkload = keyof SpaceRuntimeExecutionPools;

export interface SpaceRuntimePoolQuota {
  cpuCount: number;
  maxProcesses: number;
  maxOpenFds: number;
  maxFilesystemBytes: number;
}

export interface SpaceRuntimeExecutionPoolPolicy {
  className: string;
  credentialScope:
    | "agent-provider"
    | "build-without-provider-credentials"
    | "app-scoped-serving-capability";
  credentialEnvironmentVariables: readonly string[];
  egress: {
    mode: "allow" | "deny" | "allowlist";
    patterns: readonly string[];
    source: "development-default" | string;
  };
  quota: SpaceRuntimePoolQuota;
  metrics: {
    namespace: "vibechat_space_runtime_pool";
    workload: SpaceRuntimePoolWorkload;
  };
}

export interface SpaceRuntimeExecutionPoolPolicies {
  agentExecution: SpaceRuntimeExecutionPoolPolicy;
  appBuild: SpaceRuntimeExecutionPoolPolicy;
  releaseServing: SpaceRuntimeExecutionPoolPolicy;
}

export interface SpaceRuntimeDeploymentConfig {
  engine: {
    mode: SpaceRuntimeEngineMode;
    ownership: SpaceRuntimeEngineOwnership;
    endpoint: string;
    endpointSource:
      | "managed-default"
      | "RIVET_ENDPOINT"
      | "AGENTOS_ENDPOINT";
    publicIdentity: string;
  };
  replica: {
    id: string;
    region: string;
  };
  pools: SpaceRuntimeExecutionPools;
  dedicatedAgentPools: readonly string[];
  poolPolicies: SpaceRuntimeExecutionPoolPolicies;
  poolRoutingEnforced: true;
}

const localRivetEndpoint = "http://127.0.0.1:6420";
const identityPattern = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const maximumEgressPatterns = 64;
const maximumEgressPatternLength = 512;

export const agentProviderCredentialEnvironmentVariables = [
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

export function agentProviderCredentialsPresent(
  environment: NodeJS.ProcessEnv,
) {
  return agentProviderCredentialEnvironmentVariables.filter(
    (name) => Boolean(environment[name]?.trim()),
  );
}

export function agentProviderSessionEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  const values: Record<string, string> = Object.fromEntries(
    agentProviderCredentialEnvironmentVariables.flatMap((name) => {
      const value = environment[name];
      return value?.trim() ? [[name, value] as const] : [];
    }),
  );
  const anthropicApiKey = environment.ANTHROPIC_API_KEY
    ?? environment.ANTHROPIC_AUTH_TOKEN;
  if (anthropicApiKey?.trim()) values.ANTHROPIC_API_KEY = anthropicApiKey;
  if (environment.ANTHROPIC_BASE_URL?.trim()) {
    values.ANTHROPIC_BASE_URL = environment.ANTHROPIC_BASE_URL;
  }
  return values;
}

export function parseSpaceRuntimeDeploymentConfig(
  environment: NodeJS.ProcessEnv,
  processId = process.pid,
): SpaceRuntimeDeploymentConfig {
  const production = environment.NODE_ENV?.trim() === "production";
  const explicitMode = optionalValue(environment.SPACE_RUNTIME_ENGINE_MODE);
  if (
    explicitMode !== undefined &&
    explicitMode !== "managed" &&
    explicitMode !== "external"
  ) {
    throw new Error(
      "SPACE_RUNTIME_ENGINE_MODE must be either managed or external",
    );
  }

  const configuredEndpoint = configuredEngineEndpoint(environment);
  if (production && explicitMode !== "external") {
    throw new Error(
      "Production Space Runtime requires SPACE_RUNTIME_ENGINE_MODE=external",
    );
  }
  if (production && optionalValue(environment.PI_MODE) !== "agentos") {
    throw new Error(
      "Production Space Runtime requires PI_MODE=agentos so provider credentials stay inside the Agent execution VM allowlist",
    );
  }
  if (
    production &&
    !optionalValue(environment.SPACE_RUNTIME_POOL_WORKLOAD) &&
    agentProviderCredentialsPresent(environment).length > 0
  ) {
    throw new Error(
      "Production Space Runtime control must not receive Agent provider credentials; scope them only to the agentExecution pool worker",
    );
  }
  const mode: SpaceRuntimeEngineMode =
    explicitMode ?? (configuredEndpoint ? "external" : "managed");
  if (mode === "external" && !configuredEndpoint) {
    throw new Error(
      "External Space Runtime Engine mode requires RIVET_ENDPOINT or AGENTOS_ENDPOINT",
    );
  }

  const endpoint = normalizeEngineEndpoint(
    configuredEndpoint?.value ?? localRivetEndpoint,
  );
  const ownership: SpaceRuntimeEngineOwnership =
    mode === "external"
      ? "external"
      : configuredEndpoint
        ? "development-launcher"
        : "runtime";
  const region = requiredProductionIdentity(
    environment.SPACE_RUNTIME_REGION ?? environment.SPACE_AGENT_REGION,
    "SPACE_RUNTIME_REGION",
    production,
    "local",
  );
  const replicaId = requiredProductionIdentity(
    environment.SPACE_RUNTIME_REPLICA_ID,
    "SPACE_RUNTIME_REPLICA_ID",
    production,
    `local-${processId}`,
  );
  const pools = {
    agentExecution: poolClass(
      environment.SPACE_AGENT_EXECUTION_POOL_CLASS,
      "agent-execution",
      "SPACE_AGENT_EXECUTION_POOL_CLASS",
    ),
    appBuild: poolClass(
      environment.SPACE_APP_BUILD_POOL_CLASS,
      "app-build",
      "SPACE_APP_BUILD_POOL_CLASS",
    ),
    releaseServing: poolClass(
      environment.SPACE_RELEASE_SERVING_POOL_CLASS,
      "release-serving",
      "SPACE_RELEASE_SERVING_POOL_CLASS",
    ),
  } satisfies SpaceRuntimeExecutionPools;
  const dedicatedAgentPools = commaSeparatedPoolClasses(
    environment.SPACE_AGENT_DEDICATED_POOL_ALLOWLIST,
    "SPACE_AGENT_DEDICATED_POOL_ALLOWLIST",
  );

  if (mode === "external" && new Set(Object.values(pools)).size !== 3) {
    throw new Error(
      "External Space Runtime requires distinct Agent, App build, and Release serving pool classes",
    );
  }
  if (
    dedicatedAgentPools.some((pool) =>
      pool === pools.agentExecution
      || pool === pools.appBuild
      || pool === pools.releaseServing
    )
  ) {
    throw new Error(
      "Dedicated Agent pool classes must be distinct from regional Agent, App build, and Release serving pools",
    );
  }

  const poolPolicies = createExecutionPoolPolicies(
    environment,
    pools,
    production,
  );

  return {
    engine: {
      mode,
      ownership,
      endpoint,
      endpointSource: configuredEndpoint?.source ?? "managed-default",
      publicIdentity: publicEngineIdentity(endpoint),
    },
    replica: { id: replicaId, region },
    pools,
    dedicatedAgentPools,
    poolPolicies,
    poolRoutingEnforced: true,
  };
}

export function resolveAgentExecutionPoolClass(
  deployment: SpaceRuntimeDeploymentConfig,
  definition: {
    dataRegionPolicy: { mode: "any" | "allowlist" | "required"; regions: string[] };
    executionPoolPolicy: {
      mode: "regional_shared" | "dedicated";
      poolClass: string | null;
    };
  },
) {
  if (
    definition.dataRegionPolicy.mode !== "any"
    && !definition.dataRegionPolicy.regions.includes(deployment.replica.region)
  ) {
    throw new Error(
      `Agent Definition is not allowed in Runtime region ${deployment.replica.region}`,
    );
  }
  if (definition.executionPoolPolicy.mode === "regional_shared") {
    return deployment.pools.agentExecution;
  }
  const poolClass = definition.executionPoolPolicy.poolClass;
  if (!poolClass || !deployment.dedicatedAgentPools.includes(poolClass)) {
    throw new Error(
      `Dedicated Agent pool ${poolClass || "<missing>"} is not allowed by this Runtime deployment`,
    );
  }
  return poolClass;
}

function createExecutionPoolPolicies(
  environment: NodeJS.ProcessEnv,
  pools: SpaceRuntimeExecutionPools,
  production: boolean,
): SpaceRuntimeExecutionPoolPolicies {
  return {
    agentExecution: executionPoolPolicy({
      environment,
      production,
      workload: "agentExecution",
      className: pools.agentExecution,
      credentialScope: "agent-provider",
      credentialEnvironmentVariables:
        agentProviderCredentialEnvironmentVariables,
      egressVariable: "SPACE_AGENT_EGRESS_ALLOWLIST",
      quotaPrefix: "SPACE_AGENT_VM",
      developmentEgress: "allow",
      defaults: {
        cpuCount: 2,
        maxProcesses: 64,
        maxOpenFds: 2_048,
        maxFilesystemBytes: 512 * 1024 * 1024,
      },
    }),
    appBuild: executionPoolPolicy({
      environment,
      production,
      workload: "appBuild",
      className: pools.appBuild,
      credentialScope: "build-without-provider-credentials",
      credentialEnvironmentVariables: [],
      egressVariable: "SPACE_APP_BUILD_EGRESS_ALLOWLIST",
      quotaPrefix: "SPACE_APP_BUILD_VM",
      developmentEgress: "allow",
      defaults: {
        cpuCount: 2,
        maxProcesses: 64,
        maxOpenFds: 2_048,
        maxFilesystemBytes: 1024 * 1024 * 1024,
      },
    }),
    releaseServing: executionPoolPolicy({
      environment,
      production,
      workload: "releaseServing",
      className: pools.releaseServing,
      credentialScope: "app-scoped-serving-capability",
      credentialEnvironmentVariables: [],
      egressVariable: "SPACE_RELEASE_EGRESS_ALLOWLIST",
      quotaPrefix: "SPACE_RELEASE_VM",
      developmentEgress: "allow",
      defaults: {
        cpuCount: 1,
        maxProcesses: 32,
        maxOpenFds: 1_024,
        maxFilesystemBytes: 256 * 1024 * 1024,
      },
    }),
  };
}

function executionPoolPolicy(options: {
  environment: NodeJS.ProcessEnv;
  production: boolean;
  workload: SpaceRuntimePoolWorkload;
  className: string;
  credentialScope: SpaceRuntimeExecutionPoolPolicy["credentialScope"];
  credentialEnvironmentVariables: readonly string[];
  egressVariable: string;
  quotaPrefix: string;
  developmentEgress: "allow" | "deny";
  defaults: SpaceRuntimePoolQuota;
}): SpaceRuntimeExecutionPoolPolicy {
  const configuredEgress = optionalValue(
    options.environment[options.egressVariable],
  );
  if (options.production && !configuredEgress) {
    throw new Error(
      `Production Space Runtime requires ${options.egressVariable}; use deny or a comma-separated AgentOS network allowlist`,
    );
  }
  const egress = parseEgressPolicy(
    configuredEgress,
    options.egressVariable,
    options.developmentEgress,
  );
  return {
    className: options.className,
    credentialScope: options.credentialScope,
    credentialEnvironmentVariables: options.credentialEnvironmentVariables,
    egress,
    quota: {
      cpuCount: positiveInteger(
        options.environment[`${options.quotaPrefix}_CPU_COUNT`],
        `${options.quotaPrefix}_CPU_COUNT`,
        options.defaults.cpuCount,
        1,
        64,
      ),
      maxProcesses: positiveInteger(
        options.environment[`${options.quotaPrefix}_MAX_PROCESSES`],
        `${options.quotaPrefix}_MAX_PROCESSES`,
        options.defaults.maxProcesses,
        1,
        4_096,
      ),
      maxOpenFds: positiveInteger(
        options.environment[`${options.quotaPrefix}_MAX_OPEN_FDS`],
        `${options.quotaPrefix}_MAX_OPEN_FDS`,
        options.defaults.maxOpenFds,
        64,
        65_536,
      ),
      maxFilesystemBytes: positiveInteger(
        options.environment[`${options.quotaPrefix}_MAX_FILESYSTEM_BYTES`],
        `${options.quotaPrefix}_MAX_FILESYSTEM_BYTES`,
        options.defaults.maxFilesystemBytes,
        16 * 1024 * 1024,
        16 * 1024 * 1024 * 1024,
      ),
    },
    metrics: {
      namespace: "vibechat_space_runtime_pool",
      workload: options.workload,
    },
  };
}

function parseEgressPolicy(
  value: string | undefined,
  variable: string,
  developmentDefault: "allow" | "deny",
): SpaceRuntimeExecutionPoolPolicy["egress"] {
  if (!value) {
    return {
      mode: developmentDefault,
      patterns: [],
      source: "development-default",
    };
  }
  if (value === "allow" || value === "deny") {
    return { mode: value, patterns: [], source: variable };
  }
  const patterns = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (patterns.length === 0 || patterns.length > maximumEgressPatterns) {
    throw new Error(
      `${variable} must contain 1-${maximumEgressPatterns} comma-separated patterns, allow, or deny`,
    );
  }
  for (const pattern of patterns) {
    if (
      pattern.length > maximumEgressPatternLength ||
      pattern.includes("\0") ||
      /[\r\n]/.test(pattern)
    ) {
      throw new Error(`${variable} contains an invalid egress pattern`);
    }
  }
  return { mode: "allowlist", patterns, source: variable };
}

function positiveInteger(
  value: string | undefined,
  variable: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const configured = optionalValue(value);
  if (!configured) return fallback;
  const parsed = Number(configured);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(
      `${variable} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return parsed;
}

function configuredEngineEndpoint(environment: NodeJS.ProcessEnv) {
  const rivetEndpoint = optionalValue(environment.RIVET_ENDPOINT);
  if (rivetEndpoint) {
    return { value: rivetEndpoint, source: "RIVET_ENDPOINT" as const };
  }
  const agentOsEndpoint = optionalValue(environment.AGENTOS_ENDPOINT);
  if (agentOsEndpoint) {
    return { value: agentOsEndpoint, source: "AGENTOS_ENDPOINT" as const };
  }
  return undefined;
}

function normalizeEngineEndpoint(value: string) {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("Rivet Engine endpoint must be a valid HTTP(S) URL");
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("Rivet Engine endpoint must use HTTP or HTTPS");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error(
      "Rivet Engine endpoint must not contain credentials, query parameters, or fragments",
    );
  }
  return endpoint.toString().replace(/\/$/, "");
}

function publicEngineIdentity(endpoint: string) {
  const parsed = new URL(endpoint);
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
}

function requiredProductionIdentity(
  value: string | undefined,
  variable: string,
  production: boolean,
  fallback: string,
) {
  const resolved = optionalValue(value);
  if (!resolved && production) {
    throw new Error(`Production Space Runtime requires ${variable}`);
  }
  return validatedIdentity(resolved ?? fallback, variable);
}

function poolClass(
  value: string | undefined,
  fallback: string,
  variable: string,
) {
  return validatedIdentity(optionalValue(value) ?? fallback, variable);
}

function commaSeparatedPoolClasses(value: string | undefined, name: string) {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const unique = [...new Set(entries)];
  for (const entry of unique) {
    if (!identityPattern.test(entry)) {
      throw new Error(`${name} contains an invalid pool class: ${entry}`);
    }
  }
  return unique;
}

function validatedIdentity(value: string, variable: string) {
  if (!identityPattern.test(value)) {
    throw new Error(
      `${variable} must be 1-128 characters using letters, numbers, dot, colon, underscore, or hyphen`,
    );
  }
  return value;
}

function optionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
