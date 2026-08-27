import { mkdir } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import {
  AgentOSAppsError,
  appsRouter,
  deployApp,
} from "@rivet-dev/agentos-apps";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  spaceRuntimeAudience,
  verifySpaceRuntimeCredential,
} from "@vibechat/space-runtime-auth";
import { getOfficialSpaceTemplate } from "@vibechat/space-templates";
import { registry } from "./actors.js";
import {
  addAgentUsage,
  type AgentUsage,
} from "./agent-usage.js";
import {
  createFakeAgentAdapter,
  createPiAgentAdapter,
  SpaceAgentRegistry,
} from "./agent-adapter.js";
import {
  DevPreviewError,
  DevPreviewManager,
} from "./dev-preview.js";
import { createDurableSpaceControlFromEnv } from "./durable-space-control.js";
import {
  configuredProvider,
  hasModelCredentials,
  loadSeed,
  piMode,
  runProjectTurn,
  reviseProject,
} from "./generator.js";
import {
  createProjectFromTemplate,
  initializeProjectFromTemplate,
  loadProject,
  saveProject,
} from "./project-store.js";
import { assertAppId } from "./app-id.js";
import { checkRivetEngineHealth } from "./rivet-health.js";
import {
  type ClaimedSpaceTurn,
  SpaceInstanceServer,
  type SpaceBuildProgress,
  type SpaceMember,
} from "./space-instance-server.js";
import {
  parseBilling,
  reportTurnBilling,
  reportTurnCompletion,
  type SpaceTurnReply,
} from "./turn-callbacks.js";

const maximumPromptLength = 4_000;
const maximumRepairs = 3;
const defaultChatTemplateId = "space-default";
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
const durableSpaceControl = createDurableSpaceControlFromEnv();
const spaces = new SpaceInstanceServer(
  durableSpaceControl,
  scheduleSpace,
);
const devPreviews = new DevPreviewManager();
const internalSigningSecret = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim() ?? "";
const defaultAgentId = process.env.SPACE_AGENT_DEFAULT_ID?.trim() || "pi";
const agentAdapters = new SpaceAgentRegistry([
  createPiAgentAdapter({
    isAvailable: hasModelCredentials,
    runProjectTurn,
    reviseProject,
  }),
  ...(process.env.SPACE_AGENT_FAKE_ENABLED === "1"
    ? [createFakeAgentAdapter()]
    : []),
]);
const scheduledSpaceIds = new Set<string>();
const activeSpaceIds = new Set<string>();
const spaceScheduleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const templateBootstrapTasks = new Map<string, Promise<Awaited<ReturnType<typeof bootstrapTemplateProject>>>>();
let drainingTurnQueue = false;
const controlPlaneStartupGraceDeadline = Date.now() + 5_000;
const controlPlaneFailureLogIntervalMs = 30_000;
const controlPlaneFailureReportedAt = new Map<string, number>();
const clearControlPlaneFailure = (operation: string) => {
  controlPlaneFailureReportedAt.delete(operation);
};
const reportControlPlaneFailure = (operation: string, error: unknown) => {
  const now = Date.now();
  if (now < controlPlaneStartupGraceDeadline) return;
  const lastReportedAt = controlPlaneFailureReportedAt.get(operation) ?? 0;
  if (now - lastReportedAt < controlPlaneFailureLogIntervalMs) return;
  controlPlaneFailureReportedAt.set(operation, now);
  console.error(`Space Runtime ${operation} failed`, boundedLogError(error));
};
const scanRunnableTurns = () => {
  void durableSpaceControl.listRunnableSpaceInstanceIds()
    .then((spaceInstanceIds) => {
      clearControlPlaneFailure("runnable scan");
      for (const spaceInstanceId of spaceInstanceIds) scheduleSpace(spaceInstanceId);
    })
    .catch((error) => {
      reportControlPlaneFailure("runnable scan", error);
    });
  void durableSpaceControl.reconcileOutbox()
    .then(() => clearControlPlaneFailure("outbox reconcile"))
    .catch((error) => reportControlPlaneFailure("outbox reconcile", error));
};
scanRunnableTurns();
setInterval(scanRunnableTurns, 1_000).unref();

// Rivet actor runtime sockets must stay below macOS SUN_LEN. Worktree paths are
// often too long, so keep only ephemeral VM sockets in a short, process-scoped path.
const agentOsTemporaryDirectory = resolve(
  process.env.SPACE_RUNTIME_TMP_DIR ?? `/tmp/vc-space-runtime-${process.pid}`,
);
const rivetkitStoragePath = resolve(
  process.env.RIVETKIT_STORAGE_PATH ??
    join(process.cwd(), ".data", "rivetkit-storage"),
);
const rivetEngineDataDirectory = resolve(
  process.env.RIVET_ENGINE_DATABASE_PATH ??
    join(rivetkitStoragePath, "managed-engine", "db"),
);
await Promise.all([
  mkdir(agentOsTemporaryDirectory, { recursive: true }),
  mkdir(rivetEngineDataDirectory, { recursive: true }),
]);
process.env.TMPDIR = agentOsTemporaryDirectory;
const configuredRivetEndpoint =
  process.env.RIVET_ENDPOINT ?? process.env.AGENTOS_ENDPOINT;
const localRivetEndpoint = "http://127.0.0.1:6420";
const startsLocalRivetEngine = !configuredRivetEndpoint;
if (configuredRivetEndpoint) {
  process.env.RIVET_ENDPOINT = configuredRivetEndpoint;
} else {
  process.env.RIVET_RUN_ENGINE ??= "1";
}
// Keep this prototype's actors and releases isolated from other RivetKit
// projects on the same laptop. The environment variable remains overridable.
process.env.RIVETKIT_STORAGE_PATH ??= rivetkitStoragePath;

const registryReady = registry.startAndWait();
// AgentOS Apps resolves its client connection lazily from RIVET_ENDPOINT.
// Set it only after Registry has parsed RIVET_RUN_ENGINE, because RivetKit
// intentionally rejects an explicit endpoint combined with managed Engine mode.
if (startsLocalRivetEngine) process.env.RIVET_ENDPOINT = localRivetEndpoint;
await registryReady;

const app = new Hono();

app.use("/api/apps/*", async (context, next) => {
  if (!internalSigningSecret) return context.json({ error: "space runtime signing secret is not configured" }, 503);
  if (!await authorizeRuntimeRequest(context.req.raw, internalSigningSecret)) {
    return context.json({ error: "unauthorized" }, 401);
  }
  await next();
});
app.use("/runtime/*", async (context, next) => {
  if (!internalSigningSecret) return context.json({ error: "space runtime signing secret is not configured" }, 503);
  if (!await authorizeRuntimeRequest(context.req.raw, internalSigningSecret)) {
    return context.json({ error: "unauthorized" }, 401);
  }
  await next();
});

app.get("/api/health", async (context) => {
  const rivetEngine = await checkRivetEngineHealth(process.env.RIVET_ENDPOINT!);
  return context.json({
    ok: rivetEngine.ok,
    modelConfigured: hasModelCredentials(),
    defaultAgentId,
    availableAgents: agentAdapters.list(),
    piMode: piMode(),
    provider: configuredProvider(),
    piConcurrency: maximumConcurrentTurns,
    projectStore: "product-db+object-store",
    rivetEngineDataDirectory,
    spaceInstanceServer: durableSpaceControl.description,
    internalAuthConfigured: Boolean(internalSigningSecret),
    dependencies: { rivetEngine },
    urls: localUrls(port),
  }, rivetEngine.ok ? 200 : 503);
});

app.get("/api/apps/:appId", async (context) => {
  try {
    const appId = context.req.param("appId");
    assertAppId(appId);
    const project = await loadProject(appId);
    return context.json({
      appId,
      exists: Boolean(project),
      defaultAgentId,
      availableAgents: agentAdapters.list(),
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
    return context.json({ error: "expectedReadyRevisionId is required" }, 400);
  }
  const turn = await spaces.beginTurn(appId, {
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
  };
  const member = parseMember(body.clientId, body.authorName);
  if (typeof body.requestId !== "string" || !body.requestId.trim()) {
    return context.json({ error: "requestId is required" }, 400);
  }
  if (
    body.target !== "default-chat" ||
    typeof body.expectedReadyRevisionId !== "string" ||
    !/^[a-f0-9]{16}$/.test(body.expectedReadyRevisionId)
  ) {
    return context.json({ error: "a valid restore target and ready revision are required" }, 400);
  }
  const turn = await spaces.beginTurn(appId, {
    clientId: member.clientId,
    authorName: member.name,
    text: "恢复默认 Chat App",
    kind: "restore",
    externalRequestId: body.requestId,
    agentId: "kernel",
    recovery: {
      target: body.target,
      expectedReadyRevisionId: body.expectedReadyRevisionId,
    },
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
    kind: "message",
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
  let usage: AgentUsage | undefined;
  let reply: SpaceTurnReply | undefined;
  try {
    if (turn.kind === "publish") {
      const publication = turn.requests[0]?.publication;
      if (!publication) throw new Error("Space publish request is missing revision metadata");
      succeeded = await publishCurrentProject(
        appId,
        turn.turnId,
        publication.expectedReadyRevisionId,
      );
    } else if (turn.kind === "restore") {
      const recovery = turn.requests[0]?.recovery;
      if (!recovery) throw new Error("Space restore request is missing recovery metadata");
      succeeded = await restoreDefaultChatProject(appId, turn.turnId, recovery);
    } else {
      const agentId = turn.requests[0]?.agentId || defaultAgentId;
      const outcome = await processTurn(
        appId,
        turn.turnId,
        combinedTurnRequest(turn),
        agentId,
      );
      succeeded = outcome.succeeded;
      usage = outcome.usage;
      reply = outcome.reply;
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
    await Promise.all([
      reportTurnBilling({
        turn,
        status: succeeded ? "completed" : "failed",
        usage,
        signingSecret: internalSigningSecret,
      }).catch((error) => {
        console.error("Space turn billing callback failed", boundedLogError(error));
      }),
      ...(succeeded && reply
        ? [reportTurnCompletion({ turn, reply, signingSecret: internalSigningSecret }).catch((error) => {
            console.error("Space turn completion callback failed", boundedLogError(error));
          })]
        : []),
    ]);
  }
}

async function restoreDefaultChatProject(
  appId: string,
  turnId: string,
  recovery: NonNullable<ClaimedSpaceTurn["requests"][number]["recovery"]>,
) {
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    void spaces
      .heartbeat(appId, turnId, Math.floor((Date.now() - startedAt) / 1_000))
      .catch(() => undefined);
  }, 2_000);
  const relayProgress = (event: SpaceBuildProgress) =>
    spaces.progress(appId, turnId, event);

  try {
    const current = await loadProject(appId);
    if (!current?.draftId) {
      throw new Error("Space 还没有可恢复的 ready Revision。");
    }
    if (current.draftId !== recovery.expectedReadyRevisionId) {
      throw new SpaceReadyRevisionChangedError(
        recovery.expectedReadyRevisionId,
        current.draftId,
      );
    }
    const template = getOfficialSpaceTemplate(defaultChatTemplateId);
    if (!template) throw new Error("Default Chat Template is unavailable");

    await relayProgress({
      type: "status",
      stage: "recovering",
      message: "正在从官方 Template 准备 Default Chat App Candidate…",
    });
    const candidate = await createProjectFromTemplate(
      appId,
      template.id,
      template.currentVersionId,
    );
    const preview = await devPreviews.prepare(
      appId,
      candidate.files,
      (status) => relayProgress({
        type: "status",
        stage: "recovering",
        message: status,
      }),
      candidate.prepared,
    );
    const updatedAt = preview.updatedAt;
    const saved = await saveProject({
      ...candidate,
      updatedAt,
      draftId: preview.version,
      prepared: preview.prepared,
      ...(current.publishedDraftId
        ? { publishedDraftId: current.publishedDraftId }
        : {}),
      ...(current.releaseId ? { releaseId: current.releaseId } : {}),
    });
    await spaces.complete(appId, turnId, "已恢复 Default Chat App。", {
      type: "draft_ready",
      message: "已恢复 Default Chat App。",
      appId,
      appUrl: `/apps/${encodeURIComponent(appId)}/`,
      devUrl: preview.url,
      version: preview.version,
      updatedAt,
      recoveredFromRevisionId: current.draftId,
      recoveryTarget: recovery.target,
      publishedReleaseId: current.releaseId ?? null,
    });
    return true;
  } catch (error) {
    console.error("Default Chat recovery failed", boundedLogError(error));
    await spaces.fail(appId, turnId, errorMessage(error), spaceErrorCode(error));
    return false;
  } finally {
    clearInterval(heartbeat);
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
  let usage: AgentUsage | undefined;

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
    usage = addAgentUsage(usage, turn.usage);
    if (turn.kind === "chat") {
      await spaces.completeChat(appId, turnId, turn.message);
      return {
        succeeded: true,
        usage,
        reply: { agentId: agent.id, agentName: agent.name, text: turn.message },
      };
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
        const saved = await saveProject({
          appId,
          files: revision.files,
          summary: revision.summary,
          updatedAt,
          draftId: preview.version,
          prepared: preview.prepared,
          ...(existing?.publishedDraftId
            ? { publishedDraftId: existing.publishedDraftId }
            : {}),
          ...(existing?.releaseId ? { releaseId: existing.releaseId } : {}),
          ...(existing?.template ? { template: existing.template } : {}),
        });

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
        return {
          succeeded: true,
          usage,
          reply: {
            agentId: agent.id,
            agentName: agent.name,
            text: revision.summary,
          },
        };
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
        const repair = await agent.reviseProject({
          appId,
          request: message,
          files: revision.files,
          diagnostics,
          onProgress: relayProgress,
        });
        usage = addAgentUsage(usage, repair.usage);
        revision = repair;
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
    return { succeeded: false, usage };
  } finally {
    clearInterval(heartbeat);
  }
  return { succeeded: false, usage };
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

  // Snapshot polling also calls bootstrap. Once this Runtime process already
  // owns preview state for the App, bootstrap must be observational: rebuilding
  // the stored ready Project here would erase an in-flight or failed Candidate
  // status. An idle status means a real cold start and still rebuilds the
  // persisted Draft so its ready preview becomes locally available again.
  const currentPreview = devPreviews.status(appId);
  if (!initialized.created && currentPreview.state !== "idle") {
    return {
      created: false,
      project,
      devPreview: currentPreview,
    };
  }

  let preview = await devPreviews.prepare(
    appId,
    project.files,
    undefined,
    project.prepared,
  );

  // An Agent revision may have landed while a first template preview was
  // building. Always prepare and persist the latest files, never restore the
  // template over a newer Project revision.
  const latest = await loadProject(appId);
  if (latest && latest.updatedAt !== project.updatedAt) {
    project = latest;
    preview = await devPreviews.prepare(
      appId,
      project.files,
      undefined,
      project.prepared,
    );
  }
  if (
    project.draftId !== preview.version
    || project.prepared?.artifactHash !== preview.prepared.artifactHash
  ) {
    project = {
      ...project,
      draftId: preview.version,
      updatedAt: preview.updatedAt,
      prepared: preview.prepared,
    };
    project = await saveProject(project);
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

async function publishCurrentProject(
  appId: string,
  turnId: string,
  expectedReadyRevisionId: string,
) {
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
    if (!project.draftId || project.draftId !== expectedReadyRevisionId) {
      throw new SpaceReadyRevisionChangedError(
        expectedReadyRevisionId,
        project.draftId || "missing",
      );
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
      project.prepared,
    );
    if (preview.version !== expectedReadyRevisionId) {
      throw new SpaceReadyRevisionChangedError(
        expectedReadyRevisionId,
        preview.version,
      );
    }
    await spaces.announce(appId, {
      type: "dev_ready",
      appId,
      version: preview.version,
      devUrl: preview.url,
      updatedAt: preview.updatedAt,
    });

    const deployment = await deployRevision(
      appId,
      preview.prepared.files,
      relayProgress,
    );
    const updatedAt = new Date().toISOString();
    const saved = await saveProject({
      ...project,
      updatedAt,
      draftId: preview.version,
      publishedDraftId: preview.version,
      releaseId: deployment.release,
      prepared: preview.prepared,
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

function spaceErrorCode(error: unknown) {
  if (error instanceof SpaceReadyRevisionChangedError) return error.code;
  if (error instanceof DevPreviewError) return error.code;
  if (error instanceof AgentOSAppsError) return error.code;
  return undefined;
}

class SpaceReadyRevisionChangedError extends Error {
  readonly code = "space_ready_revision_changed";

  constructor(expected: string, actual: string) {
    super(`Space ready Revision changed from ${expected} to ${actual}; refresh and retry recovery.`);
    this.name = "SpaceReadyRevisionChangedError";
  }
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

async function authorizeRuntimeRequest(request: Request, signingSecret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const credential = authorization.slice("Bearer ".length).trim();
  if (!credential) return false;
  const url = new URL(request.url);
  const claims = await verifySpaceRuntimeCredential(credential, {
    secret: signingSecret,
    audience: spaceRuntimeAudience,
    subject: "vibechat-backend",
    method: request.method,
    path: url.pathname,
  });
  return Boolean(claims);
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
