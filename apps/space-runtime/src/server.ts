import { mkdir } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  AgentOSAppsError,
  appsRouter,
  deployApp,
} from "@rivet-dev/agentos-apps";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { registry } from "./actors.js";
import {
  DevPreviewError,
  DevPreviewManager,
} from "./dev-preview.js";
import {
  configuredProvider,
  hasModelCredentials,
  loadSeed,
  piMode,
  runProjectTurn,
  reviseProject,
} from "./generator.js";
import {
  assertAppId,
  initializeProjectFromTemplate,
  loadProject,
  projectDirectory,
  saveProject,
} from "./project-store.js";
import {
  type ClaimedSpaceTurn,
  SpaceInstanceServer,
  type SpaceBuildProgress,
  type SpaceMember,
} from "./space-instance-server.js";

const maximumPromptLength = 4_000;
const maximumRepairs = 3;
const maximumConcurrentTurns = Math.max(
  1,
  Math.min(8, Number.parseInt(process.env.PI_MAX_CONCURRENCY ?? "2", 10) || 2),
);
const turnBatchWindowMs = Math.max(
  0,
  Math.min(
    2_000,
    Number.parseInt(process.env.PI_BATCH_WINDOW_MS ?? "350", 10) || 0,
  ),
);
const port = Number(process.env.SPACE_RUNTIME_PORT ?? process.env.PORT ?? 8007);
const hostname = process.env.HOST ?? "0.0.0.0";
const spaces = new SpaceInstanceServer(scheduleSpace);
const devPreviews = new DevPreviewManager();
const internalToken = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim() ?? "";
const defaultAgentId = process.env.SPACE_AGENT_DEFAULT_ID?.trim() || "pi";
const agentAdapters = new Map([
  ["pi", {
    id: "pi",
    name: "Pi",
    runProjectTurn,
    reviseProject,
  }],
]);
const scheduledSpaceIds = new Set<string>();
const activeSpaceIds = new Set<string>();
const spaceScheduleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const templateBootstrapTasks = new Map<string, Promise<Awaited<ReturnType<typeof bootstrapTemplateProject>>>>();
let drainingTurnQueue = false;

// Rivet actor runtime sockets must stay below macOS SUN_LEN. Worktree paths are
// often too long, so keep only ephemeral VM sockets in a short, process-scoped path.
const agentOsTemporaryDirectory = resolve(
  process.env.SPACE_RUNTIME_TMP_DIR ?? `/tmp/vc-space-runtime-${process.pid}`,
);
const rivetkitStoragePath = resolve(
  process.env.RIVETKIT_STORAGE_PATH ??
    join(process.cwd(), ".data", "rivetkit-storage"),
);
const rivetEngineDataDirectory = join(
  rivetkitStoragePath,
  ".rivetkit",
  "var",
  "engine",
  "db",
);
await Promise.all([
  mkdir(agentOsTemporaryDirectory, { recursive: true }),
  mkdir(rivetEngineDataDirectory, { recursive: true }),
]);
process.env.TMPDIR = agentOsTemporaryDirectory;
process.env.RIVET_ENDPOINT ??=
  process.env.AGENTOS_ENDPOINT ?? "http://127.0.0.1:6420";
// Keep this prototype's actors and releases isolated from other RivetKit
// projects on the same laptop. The environment variable remains overridable.
process.env.RIVETKIT_STORAGE_PATH ??= rivetkitStoragePath;

registry.start();

const app = new Hono();

app.use("/api/apps/*", async (context, next) => {
  if (!internalToken) return context.json({ error: "space runtime internal token is not configured" }, 503);
  if (context.req.header("authorization") !== `Bearer ${internalToken}`) {
    return context.json({ error: "unauthorized" }, 401);
  }
  await next();
});
app.use("/runtime/*", async (context, next) => {
  if (!internalToken) return context.json({ error: "space runtime internal token is not configured" }, 503);
  if (context.req.header("authorization") !== `Bearer ${internalToken}`) {
    return context.json({ error: "unauthorized" }, 401);
  }
  await next();
});

app.get("/api/health", (context) =>
  context.json({
    ok: true,
    modelConfigured: hasModelCredentials(),
    defaultAgentId,
    availableAgents: [...agentAdapters.values()],
    piMode: piMode(),
    provider: configuredProvider(),
    piConcurrency: maximumConcurrentTurns,
    projectDirectory: projectDirectory(),
    rivetEngineDataDirectory,
    spaceInstanceServer: "local-first",
    internalAuthConfigured: Boolean(internalToken),
    urls: localUrls(port),
  }),
);

app.get("/api/apps/:appId", async (context) => {
  try {
    const appId = context.req.param("appId");
    assertAppId(appId);
    const project = await loadProject(appId);
    return context.json({
      appId,
      exists: Boolean(project),
      defaultAgentId,
      availableAgents: [...agentAdapters.values()].map((agent) => ({
        id: agent.id,
        name: agent.name,
        available: agent.id === "pi" ? hasModelCredentials() : true,
      })),
      project,
      space: await spaces.snapshot(appId),
      devPreview: devPreviews.status(appId),
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
    const existingTask = templateBootstrapTasks.get(appId);
    const task =
      existingTask ??
      bootstrapTemplateProject(appId, body.templateId, body.templateVersionId);
    if (!existingTask) templateBootstrapTasks.set(appId, task);
    try {
      return context.json(await task);
    } finally {
      if (templateBootstrapTasks.get(appId) === task) {
        templateBootstrapTasks.delete(appId);
      }
    }
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
    const unsubscribe = await spaces.subscribe(appId, member, send);
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

app.post("/api/apps/:appId/dev", async (context) => {
  const appId = context.req.param("appId");
  try {
    assertAppId(appId);
    const project = await loadProject(appId);
    if (!project) return context.json({ error: "Space 还没有开发版本" }, 404);

    void devPreviews
      .prepare(appId, project.files)
      .then(async (preview) => {
        await spaces.announce(appId, {
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
        await spaces.announce(appId, {
          type: "dev_failed",
          appId,
          message: errorMessage(error),
        });
      });
    return context.json(
      { accepted: true, devPreview: devPreviews.status(appId) },
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
  const body = request as { clientId?: unknown; authorName?: unknown; requestId?: unknown };
  const member = parseMember(body.clientId, body.authorName);
  if (typeof body.requestId !== "string" || !body.requestId.trim()) {
    return context.json({ error: "requestId is required" }, 400);
  }
  const turn = await spaces.beginTurn(appId, {
    clientId: member.clientId,
    authorName: member.name,
    text: "发布当前开发版本",
    kind: "publish",
    externalRequestId: body.requestId,
    agentId: defaultAgentId,
  });
  return context.json({ accepted: true, ...turn }, 202);
});

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
  const message = body?.message;
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > maximumPromptLength
  ) {
    return context.json(
      { error: `message must contain 1-${maximumPromptLength} characters` },
      400,
    );
  }
  if (typeof body.matrixEventId !== "string" || !body.matrixEventId.trim()) {
    return context.json({ error: "matrixEventId is required" }, 400);
  }
  const agentId = typeof body.agentId === "string" && body.agentId.trim()
    ? body.agentId.trim()
    : defaultAgentId;
  if (!agentAdapters.has(agentId)) {
    return context.json({ error: `agent adapter is not available: ${agentId}` }, 400);
  }
  const member = parseMember(body.clientId, body.authorName);
  const billing = parseBilling(body.billing);
  if (body.billing && !billing) {
    return context.json({ error: "billing callback is invalid" }, 400);
  }
  const turn = await spaces.beginTurn(appId, {
    clientId: member.clientId,
    authorName: member.name,
    text: message.trim(),
    kind: isPublishOnlyMessage(message.trim()) ? "publish" : "message",
    externalRequestId: body.matrixEventId,
    agentId,
    ...(billing ? { billing } : {}),
  });
  return context.json({ accepted: true, ...turn }, 202);
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
      const presence = await spaces.updateAppPresence(
        appId,
        member,
        payload.value,
      );
      return context.json({ ok: true, presence });
    }
    if (request.action === "state.set") {
      const result = await spaces.setAppState(appId, payload.key, payload.value);
      return context.json({ ok: true, ...result });
    }
    if (request.action === "state.delete") {
      const result = await spaces.deleteAppState(appId, payload.key);
      return context.json({ ok: true, ...result });
    }
    if (request.action === "event.emit") {
      const result = await spaces.emitAppEvent(
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
    const targetUrl = new URL(`${suffix}${sourceUrl.search}`, "http://space-dev.local");
    const method = context.req.method.toUpperCase();
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : new Uint8Array(await context.req.arrayBuffer());
    const response = await devPreviews.fetch(appId, targetUrl.href, {
      method,
      headers: requestHeaders(context.req.raw.headers),
      ...(body ? { body } : {}),
    });
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

app.route("/runtime/apps", appsRouter);
app.use("/*", serveStatic({ root: "./public" }));
app.get("*", serveStatic({ path: "./public/index.html" }));

app.onError((error, context) => {
  console.error("Unhandled request error", boundedLogError(error));
  return context.json({ error: "internal server error" }, 500);
});

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Space Runtime ready at ${localUrls(info.port).join(" · ")}`);
});

function scheduleSpace(appId: string) {
  if (activeSpaceIds.has(appId)) {
    scheduledSpaceIds.add(appId);
    return;
  }
  if (scheduledSpaceIds.has(appId) || spaceScheduleTimers.has(appId)) return;

  const timer = setTimeout(() => {
    spaceScheduleTimers.delete(appId);
    scheduledSpaceIds.add(appId);
    void drainTurnQueue();
  }, turnBatchWindowMs);
  spaceScheduleTimers.set(appId, timer);
}

async function drainTurnQueue() {
  if (drainingTurnQueue) return;
  drainingTurnQueue = true;
  try {
    while (activeSpaceIds.size < maximumConcurrentTurns) {
      const appId = [...scheduledSpaceIds].find(
        (candidate) => !activeSpaceIds.has(candidate),
      );
      if (!appId) break;
      scheduledSpaceIds.delete(appId);

      const turn = await spaces.claimTurn(appId);
      if (!turn) continue;
      activeSpaceIds.add(appId);
      void executeClaimedTurn(appId, turn).finally(() => {
        activeSpaceIds.delete(appId);
        scheduledSpaceIds.add(appId);
        void drainTurnQueue();
      });
    }
  } finally {
    drainingTurnQueue = false;
  }
}

async function executeClaimedTurn(appId: string, turn: ClaimedSpaceTurn) {
  let succeeded = false;
  try {
    if (turn.kind === "publish") {
      succeeded = await publishCurrentProject(appId, turn.turnId);
    } else {
      const agentId = turn.requests[0]?.agentId || defaultAgentId;
      succeeded = await processTurn(appId, turn.turnId, combinedTurnRequest(turn), agentId);
    }
  } catch (error) {
    console.error("Queued turn failed", boundedLogError(error));
    await spaces.fail(
      appId,
      turn.turnId,
      errorMessage(error),
      spaceErrorCode(error),
    );
  } finally {
    await reportTurnBilling(turn, succeeded ? "completed" : "failed").catch((error) => {
      console.error("Space turn billing callback failed", boundedLogError(error));
    });
  }
}

function combinedTurnRequest(turn: ClaimedSpaceTurn) {
  const [first] = turn.requests;
  if (!first) return "";
  if (turn.requests.length === 1) return first.text;
  return [
    "以下是 Space 成员按服务器接收顺序提交的多条消息，请作为同一轮协作综合处理。",
    "独立需求应合并；针对同一目标的后续明确修正覆盖前文；如果存在无法安全判断的冲突，请先说明冲突并提问，不要擅自修改有争议的部分。",
    ...turn.requests.map(
      (request, index) =>
        `${index + 1}. ${request.authorName}：${request.text}`,
    ),
  ].join("\n");
}

async function processTurn(
  appId: string,
  turnId: string,
  message: string,
  agentId: string,
) {
  const agent = agentAdapters.get(agentId);
  if (!agent) throw new Error(`Agent ${agentId} is not available`);
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    void spaces
      .heartbeat(appId, turnId, Math.floor((Date.now() - startedAt) / 1_000))
      .catch(() => undefined);
  }, 2_000);
  const relayProgress = (event: SpaceBuildProgress) =>
    spaces.progress(appId, turnId, event);

  try {
    const existing = await loadProject(appId);
    const currentFiles = existing?.files ?? (await loadSeed());
    await relayProgress({
      type: "status",
      stage: "thinking",
      message: existing
        ? `${agent.name} 正在理解消息并查看当前应用…`
        : `${agent.name} 正在理解消息并准备应用工作区…`,
    });

    const turn = await agent.runProjectTurn({
      appId,
      request: message,
      files: currentFiles,
      onProgress: relayProgress,
    });
    if (turn.kind === "chat") {
      await spaces.completeChat(appId, turnId, turn.message);
      return true;
    }
    let revision = { files: turn.files, summary: turn.summary };

    for (let attempt = 0; attempt <= maximumRepairs; attempt += 1) {
      await relayProgress({
        type: "status",
        stage: attempt === 0 ? "developing" : "repairing",
        attempt,
        message:
          attempt === 0
            ? "正在准备 Space Dev 实时预览…"
            : `正在根据构建诊断自动修复（${attempt}/${maximumRepairs}）…`,
      });

      try {
        const preview = await devPreviews.prepare(
          appId,
          revision.files,
          (status) =>
            relayProgress({
              type: "status",
              stage: "developing",
              message: status,
            }),
        );
        const updatedAt = preview.updatedAt;
        await saveProject({
          appId,
          files: revision.files,
          summary: revision.summary,
          updatedAt,
          draftId: preview.version,
          ...(existing?.publishedDraftId
            ? { publishedDraftId: existing.publishedDraftId }
            : {}),
          ...(existing?.releaseId ? { releaseId: existing.releaseId } : {}),
          ...(existing?.template ? { template: existing.template } : {}),
        });

        if (requestsPublishAfterRevision(message)) {
          await spaces.announce(appId, {
            type: "dev_ready",
            turnId,
            appId,
            version: preview.version,
            devUrl: preview.url,
            updatedAt,
          });
          const deployment = await deployRevision(
            appId,
            revision.files,
            relayProgress,
          );
          const publishedAt = new Date().toISOString();
          await saveProject({
            appId,
            files: revision.files,
            summary: revision.summary,
            updatedAt: publishedAt,
            draftId: preview.version,
            publishedDraftId: preview.version,
            releaseId: deployment.release,
            ...(existing?.template ? { template: existing.template } : {}),
          });
          await spaces.complete(appId, turnId, revision.summary, {
            type: "deployed",
            message: revision.summary,
            appId,
            appUrl: `/apps/${encodeURIComponent(appId)}/`,
            updatedAt: publishedAt,
            deployment,
          });
          return true;
        }

        await spaces.complete(appId, turnId, revision.summary, {
          type: "draft_ready",
          message: revision.summary,
          appId,
          appUrl: `/apps/${encodeURIComponent(appId)}/`,
          devUrl: preview.url,
          version: preview.version,
          updatedAt,
          publishedReleaseId: existing?.releaseId ?? null,
        });
        return true;
      } catch (error) {
        if (!isRepairableRevisionError(error) || attempt === maximumRepairs) {
          throw error;
        }
        const diagnostics = revisionDiagnostics(error);
        await relayProgress({
          type: "status",
          stage: "repairing",
          attempt: attempt + 1,
          message: `开发预览未通过，已把诊断反馈给 ${agent.name}…`,
        });
        revision = await agent.reviseProject({
          appId,
          request: message,
          files: revision.files,
          diagnostics,
          onProgress: relayProgress,
        });
      }
    }
  } catch (error) {
    console.error("Generation failed", boundedLogError(error));
    await spaces.fail(
      appId,
      turnId,
      errorMessage(error),
      spaceErrorCode(error),
    );
    return false;
  } finally {
    clearInterval(heartbeat);
  }
  return false;
}

async function bootstrapTemplateProject(
  appId: string,
  templateId: string,
  templateVersionId: string,
) {
  const initialized = await initializeProjectFromTemplate(
    appId,
    templateId,
    templateVersionId,
  );
  let project = initialized.project;
  let preview = await devPreviews.prepare(appId, project.files);

  // An Agent revision may have landed while a first template preview was
  // building. Always prepare and persist the latest files, never restore the
  // template over a newer Project revision.
  const latest = await loadProject(appId);
  if (latest && latest.updatedAt !== project.updatedAt) {
    project = latest;
    preview = await devPreviews.prepare(appId, project.files);
  }
  if (project.draftId !== preview.version) {
    project = {
      ...project,
      draftId: preview.version,
      updatedAt: preview.updatedAt,
    };
    await saveProject(project);
  }
  await spaces.announce(appId, {
    type: "dev_ready",
    appId,
    version: preview.version,
    devUrl: preview.url,
    updatedAt: preview.updatedAt,
  });
  return {
    created: initialized.created,
    project,
    devPreview: devPreviews.status(appId),
  };
}

async function publishCurrentProject(appId: string, turnId: string) {
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    void spaces
      .heartbeat(appId, turnId, Math.floor((Date.now() - startedAt) / 1_000))
      .catch(() => undefined);
  }, 2_000);
  const relayProgress = (event: SpaceBuildProgress) =>
    spaces.progress(appId, turnId, event);

  try {
    const project = await loadProject(appId);
    if (!project) {
      throw new Error("Space 还没有可发布的开发版本，请先让 Agent 创建应用。");
    }
    await relayProgress({
      type: "status",
      stage: "publishing",
      message: "正在确认 Space Dev 版本…",
    });
    const preview = await devPreviews.prepare(
      appId,
      project.files,
      (status) =>
        relayProgress({
          type: "status",
          stage: "developing",
          message: status,
        }),
    );
    await spaces.announce(appId, {
      type: "dev_ready",
      appId,
      version: preview.version,
      devUrl: preview.url,
      updatedAt: preview.updatedAt,
    });

    const deployment = await deployRevision(
      appId,
      project.files,
      relayProgress,
    );
    const updatedAt = new Date().toISOString();
    await saveProject({
      ...project,
      updatedAt,
      draftId: preview.version,
      publishedDraftId: preview.version,
      releaseId: deployment.release,
    });
    await spaces.complete(appId, turnId, "当前开发版本已正式发布。", {
      type: "deployed",
      message: "当前开发版本已正式发布。",
      appId,
      appUrl: `/apps/${encodeURIComponent(appId)}/`,
      updatedAt,
      deployment,
    });
    return true;
  } catch (error) {
    console.error("Publish failed", boundedLogError(error));
    await spaces.fail(appId, turnId, errorMessage(error), spaceErrorCode(error));
    return false;
  } finally {
    clearInterval(heartbeat);
  }
}

async function deployRevision(
  appId: string,
  files: Awaited<ReturnType<typeof loadSeed>>,
  relayProgress: (event: SpaceBuildProgress) => Promise<void>,
) {
  await relayProgress({
    type: "status",
    stage: "publishing",
    message: "正在构建不可变 release 并正式发布…",
  });
  return deployApp({
    appId,
    files,
    scaling: {
      minReplicas: 0,
      maxReplicas: 16,
      targetConcurrency: 4,
    },
  });
}

function isRepairableRevisionError(error: unknown) {
  return error instanceof DevPreviewError || isRepairableAppsError(error);
}

function revisionDiagnostics(error: unknown) {
  if (error instanceof DevPreviewError) return error.diagnostics;
  return boundedDiagnostics(error);
}

function isPublishOnlyMessage(message: string) {
  return /^(?:请)?(?:(?:把)?当前(?:开发)?版本(?:正式)?(?:发布|上线|部署)(?:一下)?|(?:正式)?(?:发布|上线|部署)(?:一下)?(?:应用|当前(?:开发)?版本|这个版本)?)[。！!]?$/i.test(
    message.trim().replace(/\s+/g, ""),
  );
}

function requestsPublishAfterRevision(message: string) {
  const normalized = message.replace(/\s+/g, "");
  if (/(?:不要|不用|暂不|先不|别)(?:发布|上线|部署)/.test(normalized)) {
    return false;
  }
  return /(?:并|然后|完成后|改完后?|做好后?)(?:直接|正式)?(?:发布|上线|部署)/.test(
    normalized,
  );
}

function spaceErrorCode(error: unknown) {
  if (error instanceof DevPreviewError) return error.code;
  if (error instanceof AgentOSAppsError) return error.code;
  return undefined;
}

function isAgentOSAppsError(error: unknown) {
  return (
    error instanceof AgentOSAppsError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("agentos_apps_"))
  );
}

function isRepairableAppsError(error: unknown) {
  if (!isAgentOSAppsError(error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    code === "agentos_apps_build_failed" ||
    code === "agentos_apps_entrypoint_not_found"
  );
}

function boundedDiagnostics(error: unknown) {
  const details = error as {
    code?: unknown;
    message?: unknown;
    metadata?: unknown;
  };
  return JSON.stringify({
    code: details.code,
    message: details.message ?? String(error),
    metadata: details.metadata,
  }).slice(0, 16 * 1024);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1_000);
  return String(error).slice(0, 1_000);
}

function boundedLogError(error: unknown) {
  const details = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    statusCode?: unknown;
  };
  return {
    name: details?.name,
    message: errorMessage(error),
    code: details?.code,
    statusCode: details?.statusCode,
  };
}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function requestHeaders(input: Headers) {
  const output: Record<string, string> = {};
  input.forEach((value, name) => {
    if (hopByHopHeaders.has(name.toLowerCase()) || name === "host") return;
    output[name] = value;
  });
  return output;
}

function responseHeaders(
  rawHeaders: Array<[string, string]> | undefined,
  headers: Record<string, string>,
) {
  const output = new Headers();
  for (const [name, value] of rawHeaders ?? Object.entries(headers)) {
    if (hopByHopHeaders.has(name.toLowerCase())) continue;
    output.append(name, value);
  }
  return output;
}

function parseMember(clientId: unknown, name: unknown): SpaceMember {
  const normalizedClientId =
    typeof clientId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(clientId)
      ? clientId
      : `guest-${Math.random().toString(36).slice(2, 10)}`;
  const normalizedName =
    typeof name === "string"
      ? name.trim().replace(/[\r\n\t]+/g, " ").slice(0, 24)
      : "";
  return {
    clientId: normalizedClientId,
    name: normalizedName || `访客 ${normalizedClientId.slice(-4)}`,
  };
}

function parseBilling(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const billing = value as Record<string, unknown>;
  if (
    typeof billing.callbackUrl !== "string" ||
    typeof billing.userId !== "string" ||
    typeof billing.requestId !== "string" ||
    typeof billing.provider !== "string" ||
    typeof billing.model !== "string" ||
    typeof billing.reservedCredits !== "number" ||
    !Number.isSafeInteger(billing.reservedCredits) ||
    billing.reservedCredits <= 0 ||
    typeof billing.transactionId !== "string"
  ) return null;
  const callbackUrl = new URL(billing.callbackUrl);
  if (callbackUrl.protocol !== "http:" && callbackUrl.protocol !== "https:") return null;
  return {
    callbackUrl: callbackUrl.href,
    userId: billing.userId,
    requestId: billing.requestId,
    provider: billing.provider,
    model: billing.model,
    reservedCredits: billing.reservedCredits,
    transactionId: billing.transactionId,
  };
}

async function reportTurnBilling(
  turn: ClaimedSpaceTurn,
  status: "completed" | "failed",
) {
  if (!internalToken) return;
  await Promise.all(turn.requests.flatMap((request) => request.billing ? [fetch(
    request.billing.callbackUrl,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${internalToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...request.billing,
        status,
        ...(status === "completed" ? { usage: {} } : {}),
      }),
    },
  ).then((response) => {
    if (!response.ok) throw new Error(`billing callback returned ${response.status}`);
  })] : []));
}

function localUrls(activePort: number) {
  const urls = new Set([`http://localhost:${activePort}`]);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      urls.add(`http://${address.address}:${activePort}`);
    }
  }
  return [...urls];
}
