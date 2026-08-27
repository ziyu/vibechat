import type { Hono } from "hono";
import {
  configuredProvider,
  hasModelCredentials,
  piMode,
} from "../../adapters/pi/config.js";
import type { SpaceRuntimeDependencies } from "../../composition/dependencies.js";
import { localUrls } from "../../composition/runtime-config.js";
import { checkRivetEngineHealth } from "../../rivet-health.js";

export function registerHealthRoutes(
  app: Hono,
  runtime: SpaceRuntimeDependencies,
) {
  app.get("/api/health", async (context) => {
    const rivetEngine = await checkRivetEngineHealth(
      runtime.config.deployment.engine.endpoint,
    );
    const { config } = runtime;
    return context.json(
      {
        ok: rivetEngine.ok,
        modelConfigured: hasModelCredentials(),
        defaultAgentId: config.defaultAgentId,
        availableAgents: runtime.agentAdapters.list(),
        piMode: piMode(),
        provider: configuredProvider(),
        agentConcurrency: config.scheduling.maximumConcurrentTurns,
        turnBatchWindowMs: config.scheduling.turnBatchWindowMs,
        schedulingConfigSources: config.scheduling.sources,
        piConcurrency: config.scheduling.maximumConcurrentTurns,
        projectStore: "product-db+object-store",
        deployment: {
          engineMode: config.deployment.engine.mode,
          engineOwnership: config.deployment.engine.ownership,
          engineIdentity: config.deployment.engine.publicIdentity,
          replicaId: config.deployment.replica.id,
          region: config.deployment.replica.region,
          executionPools: config.deployment.pools,
          poolPolicies: publicPoolPolicies(config.deployment.poolPolicies),
          poolRoutingEnforced: config.deployment.poolRoutingEnforced,
        },
        rivetEngineDataDirectory:
          config.deployment.engine.ownership === "runtime"
            ? config.rivetEngineDataDirectory
            : null,
        spaceInstanceServer: runtime.durableSpaceControl.description,
        internalAuthConfigured: Boolean(config.internalSigningSecret),
        dependencies: { rivetEngine },
        urls: localUrls(config.port),
      },
      rivetEngine.ok ? 200 : 503,
    );
  });
}

function publicPoolPolicies(
  policies: SpaceRuntimeDependencies["config"]["deployment"]["poolPolicies"],
) {
  return Object.fromEntries(
    Object.entries(policies).map(([workload, policy]) => [
      workload,
      {
        className: policy.className,
        credentialScope: policy.credentialScope,
        credentialEnvironmentVariableCount:
          policy.credentialEnvironmentVariables.length,
        egress: {
          mode: policy.egress.mode,
          patternCount: policy.egress.patterns.length,
          source: policy.egress.source,
        },
        quota: policy.quota,
        metrics: policy.metrics,
      },
    ]),
  );
}
