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
      process.env.RIVET_ENDPOINT!,
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
        rivetEngineDataDirectory: config.rivetEngineDataDirectory,
        spaceInstanceServer: runtime.durableSpaceControl.description,
        internalAuthConfigured: Boolean(config.internalSigningSecret),
        dependencies: { rivetEngine },
        urls: localUrls(config.port),
      },
      rivetEngine.ok ? 200 : 503,
    );
  });
}
