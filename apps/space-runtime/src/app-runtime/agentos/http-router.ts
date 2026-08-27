import { createClient } from "@rivet-dev/agentos/client";
import { createAppsRouter } from "@rivet-dev/agentos-apps/advanced";
import type { AgentOsAppBuildRegistry } from "../../actors.js";

const client = createClient<AgentOsAppBuildRegistry>({
  endpoint:
    process.env.RIVET_ENDPOINT ??
    process.env.AGENTOS_ENDPOINT ??
    "http://127.0.0.1:6420",
  poolName: process.env.SPACE_APP_BUILD_POOL_CLASS ?? "app-build",
});

export const agentOsAppsRouter = createAppsRouter({ client });
