import type { Hono } from "hono";
import { assertAppId } from "../../app-id.js";
import { agentOsAppsRouter } from "../../app-runtime/agentos/http-router.js";
import type { SpaceRuntimeDependencies } from "../../composition/dependencies.js";
import { errorMessage } from "../../composition/errors.js";
import { DevPreviewError } from "../../release-manager/dev-preview-manager.js";
import { requestHeaders, responseHeaders } from "./headers.js";

export function registerAppProxyRoutes(
  app: Hono,
  runtime: SpaceRuntimeDependencies,
) {
  app.all("/runtime/dev/apps/:appId", (context) =>
    context.redirect(`${context.req.path}/`, 308),
  );
  app.all("/runtime/dev/apps/:appId/*", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
      const sourceUrl = new URL(context.req.url);
      const prefix = `/runtime/dev/apps/${encodeURIComponent(appId)}`;
      const suffix = sourceUrl.pathname.startsWith(prefix)
        ? sourceUrl.pathname.slice(prefix.length) || "/"
        : "/";
      const targetUrl = new URL(
        `${suffix}${sourceUrl.search}`,
        "http://space-dev.local",
      );
      const method = context.req.method.toUpperCase();
      const body =
        method === "GET" || method === "HEAD"
          ? undefined
          : new Uint8Array(await context.req.arrayBuffer());
      const response = await runtime.devPreviews.fetch(
        appId,
        targetUrl.href,
        {
          method,
          headers: requestHeaders(context.req.raw.headers),
          ...(body ? { body } : {}),
        },
      );
      return new Response(Uint8Array.from(response.body).buffer, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders(response.rawHeaders, response.headers),
      });
    } catch (error) {
      const status = error instanceof DevPreviewError ? 503 : 400;
      return context.json({ error: errorMessage(error) }, status);
    }
  });

  app.route("/runtime/apps", agentOsAppsRouter);
}
