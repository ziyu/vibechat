import { mkdir } from "node:fs/promises";
import { getOfficialSpaceTemplate } from "@vibechat/space-templates";
import { createFakeAgentAdapter } from "../adapters/fake/adapter.js";
import { createPiAgentAdapter } from "../adapters/pi/adapter.js";
import { loadSeed } from "../adapters/pi/project-workspace.js";
import { SpaceAgentAdapterRegistry } from "../adapters/registry.js";
import { AgentOsAppExecutionRuntime } from "../app-runtime/agentos/app-runtime.js";
import { createDurableSpaceControlFromEnv } from "../durable-space-control.js";
import { registry } from "../infrastructure/actors.js";
import {
  createProjectFromTemplate,
  initializeProjectFromTemplate,
  loadProject,
  saveProject,
} from "../project-store.js";
import {
  DevPreviewManager,
} from "../release-manager/dev-preview-manager.js";
import { ReleaseManager } from "../release-manager/release-manager.js";
import { ClaimedTurnExecutor } from "../scheduler/claimed-turn-executor.js";
import { SpaceTurnScheduler } from "../scheduler/turn-scheduler.js";
import {
  type ClaimedSpaceTurn,
  SpaceInstanceServer,
} from "../space-instance-server.js";
import {
  reportTurnBilling,
  reportTurnCompletion,
} from "../turn-callbacks.js";
import { AgentTurnProcessor } from "../turn-processor/process-agent-turn.js";
import { PublishTurnProcessor } from "../turn-processor/process-publish-turn.js";
import { RestoreTurnProcessor } from "../turn-processor/process-restore-turn.js";
import type { SpaceRuntimeDependencies } from "./dependencies.js";
import {
  boundedLogError,
  errorMessage,
  isRepairableRevisionError,
  revisionDiagnostics,
  SpaceReadyRevisionChangedError,
  spaceErrorCode,
} from "./errors.js";
import {
  createSpaceRuntimeConfig,
  type SpaceRuntimeConfig,
} from "./runtime-config.js";

export async function createRuntime(
  config: SpaceRuntimeConfig = createSpaceRuntimeConfig(),
): Promise<SpaceRuntimeDependencies> {
  const durableSpaceControl = createDurableSpaceControlFromEnv();
  const appExecutionRuntime = new AgentOsAppExecutionRuntime();
  const devPreviews = new DevPreviewManager(appExecutionRuntime);
  const releaseManager = new ReleaseManager(appExecutionRuntime);
  const agentAdapters = new SpaceAgentAdapterRegistry([
    createPiAgentAdapter(),
    ...(process.env.SPACE_AGENT_FAKE_ENABLED === "1"
      ? [createFakeAgentAdapter()]
      : []),
  ]);

  let spaces: SpaceInstanceServer;
  const agentTurnProcessor = new AgentTurnProcessor({
    maximumRepairs: config.maximumRepairs,
    getAgent: (agentId) => agentAdapters.get(agentId),
    loadProject,
    loadSeed,
    saveProject,
    preparePreview: ({ spaceInstanceId, files, onStatus }) =>
      devPreviews.prepare(spaceInstanceId, files, onStatus),
    heartbeat: ({ spaceInstanceId, turnId, elapsedSeconds }) =>
      spaces.heartbeat(spaceInstanceId, turnId, elapsedSeconds),
    progress: ({ spaceInstanceId, turnId, event }) =>
      spaces.progress(spaceInstanceId, turnId, event),
    completeChat: ({ spaceInstanceId, turnId, message }) =>
      spaces.completeChat(spaceInstanceId, turnId, message),
    completeRevision: ({ spaceInstanceId, turnId, summary, event }) =>
      spaces.complete(spaceInstanceId, turnId, summary, event),
    failTurn: ({ spaceInstanceId, turnId, error }) =>
      spaces.fail(
        spaceInstanceId,
        turnId,
        errorMessage(error),
        spaceErrorCode(error),
      ),
    isRepairableRevisionError,
    revisionDiagnostics,
    reportError: (message, error) => {
      console.error(message, boundedLogError(error));
    },
  });
  const publishTurnProcessor = new PublishTurnProcessor({
    loadProject,
    preparePreview: ({ spaceInstanceId, files, onStatus }) =>
      devPreviews.prepare(spaceInstanceId, files, onStatus),
    heartbeat: ({ spaceInstanceId, turnId, elapsedSeconds }) =>
      spaces.heartbeat(spaceInstanceId, turnId, elapsedSeconds),
    progress: ({ spaceInstanceId, turnId, event }) =>
      spaces.progress(spaceInstanceId, turnId, event),
    announce: ({ spaceInstanceId, event }) =>
      spaces.announce(spaceInstanceId, event),
    deployRevision: ({ spaceInstanceId, files, onProgress }) =>
      releaseManager.deploy({ spaceInstanceId, files, onProgress }),
    saveProject,
    complete: ({ spaceInstanceId, turnId, message, event }) =>
      spaces.complete(spaceInstanceId, turnId, message, event),
    failTurn: ({ spaceInstanceId, turnId, error }) =>
      spaces.fail(
        spaceInstanceId,
        turnId,
        errorMessage(error),
        spaceErrorCode(error),
      ),
    createReadyRevisionChangedError: (expected, actual) =>
      new SpaceReadyRevisionChangedError(expected, actual),
    reportError: (message, error) => {
      console.error(message, boundedLogError(error));
    },
  });
  const restoreTurnProcessor = new RestoreTurnProcessor({
    loadProject,
    getDefaultTemplate: () =>
      getOfficialSpaceTemplate(config.defaultChatTemplateId),
    createProjectFromTemplate: ({
      spaceInstanceId,
      templateId,
      templateVersionId,
    }) =>
      createProjectFromTemplate(
        spaceInstanceId,
        templateId,
        templateVersionId,
      ),
    preparePreview: ({ spaceInstanceId, files, onStatus }) =>
      devPreviews.prepare(spaceInstanceId, files, onStatus),
    heartbeat: ({ spaceInstanceId, turnId, elapsedSeconds }) =>
      spaces.heartbeat(spaceInstanceId, turnId, elapsedSeconds),
    progress: ({ spaceInstanceId, turnId, event }) =>
      spaces.progress(spaceInstanceId, turnId, event),
    saveProject,
    complete: ({ spaceInstanceId, turnId, message, event }) =>
      spaces.complete(spaceInstanceId, turnId, message, event),
    failTurn: ({ spaceInstanceId, turnId, error }) =>
      spaces.fail(
        spaceInstanceId,
        turnId,
        errorMessage(error),
        spaceErrorCode(error),
      ),
    createReadyRevisionChangedError: (expected, actual) =>
      new SpaceReadyRevisionChangedError(expected, actual),
    reportError: (message, error) => {
      console.error(message, boundedLogError(error));
    },
  });
  const claimedTurnExecutor = new ClaimedTurnExecutor({
    defaultAgentId: config.defaultAgentId,
    executeAgentTurn: ({ spaceInstanceId, turn, agentId }) =>
      agentTurnProcessor.process({
        spaceInstanceId,
        turnId: turn.turnId,
        message: combinedTurnRequest(turn),
        agentId,
      }),
    executePublishTurn: ({
      spaceInstanceId,
      turnId,
      expectedReadyRevisionId,
    }) =>
      publishTurnProcessor.process({
        spaceInstanceId,
        turnId,
        expectedReadyRevisionId,
      }),
    executeRestoreTurn: ({ spaceInstanceId, turnId, recovery }) =>
      restoreTurnProcessor.process({ spaceInstanceId, turnId, recovery }),
    failTurn: ({ spaceInstanceId, turnId, error }) =>
      spaces.fail(
        spaceInstanceId,
        turnId,
        errorMessage(error),
        spaceErrorCode(error),
      ),
    reportBilling: (input) =>
      reportTurnBilling({
        ...input,
        signingSecret: config.internalSigningSecret,
      }),
    reportCompletion: (input) =>
      reportTurnCompletion({
        ...input,
        signingSecret: config.internalSigningSecret,
      }),
    reportError: (message, error) => {
      console.error(message, boundedLogError(error));
    },
  });
  const turnScheduler = new SpaceTurnScheduler<ClaimedSpaceTurn>({
    maximumConcurrentTurns: config.scheduling.maximumConcurrentTurns,
    turnBatchWindowMs: config.scheduling.turnBatchWindowMs,
    claimTurn: (spaceInstanceId) => spaces.claimTurn(spaceInstanceId),
    executeTurn: (spaceInstanceId, turn) =>
      claimedTurnExecutor.execute(spaceInstanceId, turn),
  });
  spaces = new SpaceInstanceServer(durableSpaceControl, (spaceInstanceId) =>
    turnScheduler.schedule(spaceInstanceId),
  );

  await startAgentOsInfrastructure(config);

  const clearControlPlaneFailure = createControlPlaneFailureReporter();
  const scanRunnableTurns = () => {
    void durableSpaceControl
      .listRunnableSpaceInstanceIds()
      .then((spaceInstanceIds) => {
        clearControlPlaneFailure.succeeded("runnable scan");
        for (const spaceInstanceId of spaceInstanceIds) {
          turnScheduler.schedule(spaceInstanceId);
        }
      })
      .catch((error) => {
        clearControlPlaneFailure.failed("runnable scan", error);
      });
    void durableSpaceControl
      .reconcileOutbox()
      .then(() => clearControlPlaneFailure.succeeded("outbox reconcile"))
      .catch((error) =>
        clearControlPlaneFailure.failed("outbox reconcile", error),
      );
  };
  scanRunnableTurns();
  setInterval(scanRunnableTurns, 1_000).unref();

  const templateBootstrapTasks = new Map<
    string,
    Promise<Awaited<ReturnType<typeof bootstrapTemplateProject>>>
  >();

  async function bootstrapTemplateProject(
    spaceInstanceId: string,
    templateId: string,
    templateVersionId: string,
  ) {
    const initialized = await initializeProjectFromTemplate(
      spaceInstanceId,
      templateId,
      templateVersionId,
    );
    let project = initialized.project;

    const currentPreview = devPreviews.status(spaceInstanceId);
    if (!initialized.created && currentPreview.state !== "idle") {
      return {
        created: false,
        project,
        devPreview: currentPreview,
      };
    }

    let preview = await devPreviews.prepare(spaceInstanceId, project.files);
    const latest = await loadProject(spaceInstanceId);
    if (latest && latest.updatedAt !== project.updatedAt) {
      project = latest;
      preview = await devPreviews.prepare(spaceInstanceId, project.files);
    }
    if (project.draftId !== preview.version) {
      project = {
        ...project,
        draftId: preview.version,
        updatedAt: preview.updatedAt,
      };
      project = await saveProject(project);
    }
    await spaces.announce(spaceInstanceId, {
      type: "dev_ready",
      appId: spaceInstanceId,
      version: preview.version,
      devUrl: preview.url,
      updatedAt: preview.updatedAt,
    });
    return {
      created: initialized.created,
      project,
      devPreview: devPreviews.status(spaceInstanceId),
    };
  }

  return {
    config,
    durableSpaceControl,
    agentAdapters,
    devPreviews,
    spaces,
    async bootstrapTemplateProject(
      spaceInstanceId: string,
      templateId: string,
      templateVersionId: string,
    ) {
      const existingTask = templateBootstrapTasks.get(spaceInstanceId);
      const task =
        existingTask ??
        bootstrapTemplateProject(
          spaceInstanceId,
          templateId,
          templateVersionId,
        );
      if (!existingTask) templateBootstrapTasks.set(spaceInstanceId, task);
      try {
        return await task;
      } finally {
        if (templateBootstrapTasks.get(spaceInstanceId) === task) {
          templateBootstrapTasks.delete(spaceInstanceId);
        }
      }
    },
  };
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

async function startAgentOsInfrastructure(config: SpaceRuntimeConfig) {
  await Promise.all([
    mkdir(config.agentOsTemporaryDirectory, { recursive: true }),
    mkdir(config.rivetEngineDataDirectory, { recursive: true }),
  ]);
  process.env.TMPDIR = config.agentOsTemporaryDirectory;
  const startsLocalRivetEngine = !config.configuredRivetEndpoint;
  if (config.configuredRivetEndpoint) {
    process.env.RIVET_ENDPOINT = config.configuredRivetEndpoint;
  } else {
    process.env.RIVET_RUN_ENGINE ??= "1";
  }
  process.env.RIVETKIT_STORAGE_PATH ??= config.rivetkitStoragePath;

  const registryReady = registry.startAndWait();
  if (startsLocalRivetEngine) {
    process.env.RIVET_ENDPOINT = config.localRivetEndpoint;
  }
  await registryReady;
}

function createControlPlaneFailureReporter() {
  const startupGraceDeadline = Date.now() + 5_000;
  const failureLogIntervalMs = 30_000;
  const failureReportedAt = new Map<string, number>();
  return {
    succeeded(operation: string) {
      failureReportedAt.delete(operation);
    },
    failed(operation: string, error: unknown) {
      const now = Date.now();
      if (now < startupGraceDeadline) return;
      const lastReportedAt = failureReportedAt.get(operation) ?? 0;
      if (now - lastReportedAt < failureLogIntervalMs) return;
      failureReportedAt.set(operation, now);
      console.error(
        `Space Runtime ${operation} failed`,
        boundedLogError(error),
      );
    },
  };
}
