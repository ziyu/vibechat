import { Hono } from "hono";
import type { SpaceRuntimeDependencies } from "./dependencies.js";
import { boundedLogError } from "./errors.js";
import { registerAppProxyRoutes } from "../transport/http/app-proxy-routes.js";
import { authorizeRuntimeRequest } from "../transport/http/auth.js";
import { registerHealthRoutes } from "../transport/http/health-routes.js";
import { registerInstanceRoutes } from "../transport/http/instance-routes.js";
import { registerProjectRoutes } from "../transport/http/project-routes.js";
import { registerTurnRoutes } from "../transport/http/turn-routes.js";

export function createHttpApp(runtime: SpaceRuntimeDependencies) {
  const app = new Hono();
  const authorize = async (context: Parameters<Parameters<typeof app.use>[1]>[0], next: () => Promise<void>) => {
    const signingSecret = runtime.config.internalSigningSecret;
    if (!signingSecret) {
      return context.json(
        { error: "space runtime signing secret is not configured" },
        503,
      );
    }
    if (!await authorizeRuntimeRequest(context.req.raw, signingSecret)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    await next();
  };

  app.use("/api/apps/*", authorize);
  app.use("/runtime/*", authorize);

  registerHealthRoutes(app, runtime);
  registerInstanceRoutes(app, runtime);
  registerProjectRoutes(app, runtime);
  registerTurnRoutes(app, runtime);
  registerAppProxyRoutes(app, runtime);

  app.onError((error, context) => {
    console.error("Unhandled request error", boundedLogError(error));
    return context.json({ error: "internal server error" }, 500);
  });

  return app;
}
