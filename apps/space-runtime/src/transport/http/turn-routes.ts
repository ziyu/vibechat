import type { Hono } from "hono";
import { assertAppId } from "../../app-id.js";
import type { SpaceRuntimeDependencies } from "../../composition/dependencies.js";
import { errorMessage } from "../../composition/errors.js";
import { parseBilling } from "../../turn-callbacks.js";
import { parseMember } from "./member.js";

export function registerTurnRoutes(
  app: Hono,
  runtime: SpaceRuntimeDependencies,
) {
  app.post("/api/apps/:appId/messages", async (context) => {
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
      return context.json({ error: "request body must be valid JSON" }, 400);
    }
    const body = request as {
      message?: unknown;
      clientId?: unknown;
      authorName?: unknown;
      matrixEventId?: unknown;
      agentId?: unknown;
      billing?: unknown;
    };
    const message = body.message;
    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > runtime.config.maximumPromptLength
    ) {
      return context.json(
        {
          error: `message must contain 1-${runtime.config.maximumPromptLength} characters`,
        },
        400,
      );
    }
    if (typeof body.matrixEventId !== "string" || !body.matrixEventId.trim()) {
      return context.json({ error: "matrixEventId is required" }, 400);
    }
    const agentId =
      typeof body.agentId === "string" && body.agentId.trim()
        ? body.agentId.trim()
        : runtime.config.defaultAgentId;
    if (!runtime.agentAdapters.has(agentId)) {
      return context.json(
        { error: `agent adapter is not available: ${agentId}` },
        400,
      );
    }
    const member = parseMember(body.clientId, body.authorName);
    const billing = parseBilling(body.billing);
    if (body.billing && !billing) {
      return context.json({ error: "billing callback is invalid" }, 400);
    }
    const turn = await runtime.spaces.beginTurn(appId, {
      clientId: member.clientId,
      authorName: member.name,
      text: message.trim(),
      kind: "message",
      externalRequestId: body.matrixEventId,
      agentId,
      ...(billing ? { billing } : {}),
    });
    return context.json({ accepted: true, ...turn }, 202);
  });
}
