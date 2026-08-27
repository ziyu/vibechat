import type { Hono } from "hono";
import { assertAppId } from "../../app-id.js";
import type { SpaceRuntimeDependencies } from "../../composition/dependencies.js";
import {
  boundedLogError,
  errorMessage,
} from "../../composition/errors.js";
import { loadProject } from "../../project-store.js";
import {
  DevPreviewError,
} from "../../release-manager/dev-preview-manager.js";
import { parseMember } from "./member.js";

export function registerProjectRoutes(
  app: Hono,
  runtime: SpaceRuntimeDependencies,
) {
  app.post("/api/apps/:appId/dev", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
      const project = await loadProject(appId);
      if (!project) {
        return context.json({ error: "Space 还没有开发版本" }, 404);
      }

      void runtime.devPreviews
        .prepare(appId, project.files)
        .then(async (preview) => {
          await runtime.spaces.announce(appId, {
            type: "dev_ready",
            appId,
            version: preview.version,
            devUrl: preview.url,
            updatedAt: preview.updatedAt,
          });
        })
        .catch(async (error) => {
          console.error("Dev preview failed", {
            ...boundedLogError(error),
            diagnostics:
              error instanceof DevPreviewError
                ? error.diagnostics.slice(0, 4_000)
                : undefined,
          });
          await runtime.spaces.announce(appId, {
            type: "dev_failed",
            appId,
            message: errorMessage(error),
          });
        });
      return context.json(
        { accepted: true, devPreview: runtime.devPreviews.status(appId) },
        202,
      );
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/apps/:appId/publish", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }

    let request: unknown;
    try {
      request = await context.req.json();
    } catch {
      request = {};
    }
    const body = request as {
      clientId?: unknown;
      authorName?: unknown;
      requestId?: unknown;
      expectedReadyRevisionId?: unknown;
    };
    const member = parseMember(body.clientId, body.authorName);
    if (typeof body.requestId !== "string" || !body.requestId.trim()) {
      return context.json({ error: "requestId is required" }, 400);
    }
    if (
      typeof body.expectedReadyRevisionId !== "string" ||
      !/^[a-f0-9]{16}$/.test(body.expectedReadyRevisionId)
    ) {
      return context.json(
        { error: "expectedReadyRevisionId is required" },
        400,
      );
    }
    const turn = await runtime.spaces.beginTurn(appId, {
      clientId: member.clientId,
      authorName: member.name,
      text: "发布当前开发版本",
      kind: "publish",
      externalRequestId: body.requestId,
      agentId: "kernel",
      publication: {
        expectedReadyRevisionId: body.expectedReadyRevisionId,
      },
    });
    return context.json({ accepted: true, ...turn }, 202);
  });

  app.post("/api/apps/:appId/restore", async (context) => {
    const appId = context.req.param("appId");
    try {
      assertAppId(appId);
    } catch (error) {
      return context.json({ error: errorMessage(error) }, 400);
    }

    let request: unknown;
    try {
      request = await context.req.json();
    } catch {
      request = {};
    }
    const body = request as {
      clientId?: unknown;
      authorName?: unknown;
      requestId?: unknown;
      target?: unknown;
      expectedReadyRevisionId?: unknown;
      templateId?: unknown;
      templateVersionId?: unknown;
    };
    const member = parseMember(body.clientId, body.authorName);
    if (typeof body.requestId !== "string" || !body.requestId.trim()) {
      return context.json({ error: "requestId is required" }, 400);
    }
    if (
      (body.target !== "default-chat" && body.target !== "template") ||
      typeof body.expectedReadyRevisionId !== "string" ||
      !/^[a-f0-9]{16}$/.test(body.expectedReadyRevisionId)
    ) {
      return context.json(
        { error: "a valid restore target and ready revision are required" },
        400,
      );
    }
    if (
      body.target === "template"
      && (
        typeof body.templateId !== "string"
        || !body.templateId.trim()
        || typeof body.templateVersionId !== "string"
        || !body.templateVersionId.trim()
      )
    ) {
      return context.json(
        { error: "templateId and templateVersionId are required" },
        400,
      );
    }
    const recovery = body.target === "template"
      ? {
          target: "template" as const,
          expectedReadyRevisionId: body.expectedReadyRevisionId,
          templateId: body.templateId as string,
          templateVersionId: body.templateVersionId as string,
        }
      : {
          target: "default-chat" as const,
          expectedReadyRevisionId: body.expectedReadyRevisionId,
        };
    const turn = await runtime.spaces.beginTurn(appId, {
      clientId: member.clientId,
      authorName: member.name,
      text: body.target === "template" ? "应用 Space Template" : "恢复默认 Chat App",
      kind: "restore",
      externalRequestId: body.requestId,
      agentId: "kernel",
      recovery,
    });
    return context.json({ accepted: true, ...turn }, 202);
  });
}
