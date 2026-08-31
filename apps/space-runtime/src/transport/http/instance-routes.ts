import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { assertAppId } from "../../app-id.js";
import type { SpaceRuntimeDependencies } from "../../composition/dependencies.js";
import { errorMessage } from "../../composition/errors.js";
import { loadProject } from "../../project-store.js";
import { parseMember } from "./member.js";

export function registerInstanceRoutes(
  app: Hono,
  runtime: SpaceRuntimeDependencies,
) {
  app.get("/api/apps/:appId", async (context) => {
    try {
      const appId = context.req.param("appId");
      assertAppId(appId);
      const project = await loadProject(appId);
      return context.json({
        appId,
        exists: Boolean(project),
        defaultAgentId: runtime.config.defaultAgentId,
        availableAgents: runtime.agentAdapters.list(),
        project,
        space: await runtime.spaces.snapshot(appId),
        devPreview: runtime.devPreviews.status(appId),
        appUrl: `/apps/${encodeURIComponent(appId)}/`,
      });
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/apps/:appId/bootstrap", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
      const body = (await context.req.json()) as {
        templateId?: unknown;
        templateVersionId?: unknown;
      };
      if (
        typeof body.templateId !== "string" ||
        !body.templateId.trim() ||
        typeof body.templateVersionId !== "string" ||
        !body.templateVersionId.trim()
      ) {
        return context.json(
          { error: "templateId and templateVersionId are required" },
          400,
        );
      }
      return context.json(
        await runtime.bootstrapTemplateProject(
          appId,
          body.templateId,
          body.templateVersionId,
        ),
      );
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }
  });

  app.get("/api/apps/:appId/events", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }

    const member = parseMember(
      context.req.query("clientId"),
      context.req.query("name"),
    );
    context.header("x-accel-buffering", "no");
    return streamSSE(context, async (output) => {
      let writeQueue = Promise.resolve();
      const send = async (event: Record<string, unknown> & { type: string }) => {
        writeQueue = writeQueue.then(async () => {
          await output.writeSSE({
            data: JSON.stringify(event),
            id: String(event.spaceSequence ?? ""),
          });
        });
        await writeQueue;
      };
      const unsubscribe = await runtime.spaces.subscribe(appId, member, send);
      const ping = setInterval(() => {
        void send({ type: "ping", now: Date.now() }).catch(() => undefined);
      }, 15_000);

      await new Promise<void>((resolve) => {
        output.onAbort(() => resolve());
      });
      clearInterval(ping);
      await unsubscribe();
      await writeQueue.catch(() => undefined);
    });
  });

  app.post("/api/apps/:appId/bridge", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
      const request = (await context.req.json()) as {
        clientId?: unknown;
        authorName?: unknown;
        action?: unknown;
        payload?: unknown;
      };
      if (typeof request.action !== "string") {
        throw new Error("bridge action is required");
      }
      const member = parseMember(request.clientId, request.authorName);
      const payload =
        request.payload && typeof request.payload === "object"
          ? (request.payload as Record<string, unknown>)
          : {};

      if (request.action === "presence.update") {
        const presence = await runtime.spaces.updateAppPresence(
          appId,
          member,
          payload.value,
        );
        return context.json({ ok: true, presence });
      }
      if (request.action === "state.set") {
        const result = await runtime.spaces.setAppState(
          appId,
          payload.key,
          payload.value,
        );
        return context.json({ ok: true, ...result });
      }
      if (request.action === "state.delete") {
        const result = await runtime.spaces.deleteAppState(appId, payload.key);
        return context.json({ ok: true, ...result });
      }
      if (request.action === "event.emit") {
        const result = await runtime.spaces.emitAppEvent(
          appId,
          member,
          payload.name,
          payload.payload,
        );
        return context.json({ ok: true, ...result });
      }
      return context.json({ error: "unsupported bridge action" }, 400);
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }
  });
}
