import { createHash } from "node:crypto";
import {
  agentEventV1Schema,
  agentSessionRefV1Schema,
  agentTurnInputV1Schema,
  type AgentErrorV1,
  type AgentEventV1,
  type AgentSessionRefV1,
  type AgentTurnInputV1,
  type AgentUsageV1,
  type CancelAgentTurnInputV1,
} from "@vibechat/space-agent-contracts";
import {
  addAgentUsage,
  type AgentUsage,
} from "../agent-usage.js";
import type { CompleteSpaceAgentAdapter } from "../adapters/contract.js";
import { createAgentProjectWorkspace } from "../adapters/project-workspace.js";
import type {
  DurableAgentAuditEvent,
  DurableAgentTurnControl,
} from "../durable-space-control.js";
import type { DevPreviewResult } from "../dev-preview.js";
import type {
  ProjectFiles,
  StoredProject,
} from "../project-store.js";
import type {
  SpaceBuildProgress,
  SpaceEvent,
} from "../space-instance-server.js";
import type { SpaceTurnReply } from "../turn-callbacks.js";

export interface AgentTurnProcessResult {
  succeeded: boolean;
  usage?: AgentUsage;
  reply?: SpaceTurnReply;
}

export interface AgentTurnProcessorDependencies {
  maximumRepairs: number;
  getAgent(adapterKey: string): CompleteSpaceAgentAdapter | undefined;
  loadProject(spaceInstanceId: string): Promise<StoredProject | null>;
  saveProject(project: Omit<StoredProject, "sourceHash">): Promise<unknown>;
  loadAgentSession(input: {
    spaceInstanceId: string;
    agentId: string;
    sessionId: string;
    generation: number;
  }): Promise<AgentSessionRefV1 | null>;
  saveAgentSession(turnId: string, session: AgentSessionRefV1): Promise<void>;
  rebuildAgentSession(input: {
    turnId: string;
    session: AgentSessionRefV1;
  }): Promise<AgentSessionRefV1>;
  recordAgentAudit(turnId: string, event: DurableAgentAuditEvent): Promise<void>;
  getAgentTurnControl(
    spaceInstanceId: string,
    turnId: string,
  ): Promise<DurableAgentTurnControl>;
  preparePreview(input: {
    spaceInstanceId: string;
    files: ProjectFiles;
    onStatus: (status: string) => void | Promise<void>;
  }): Promise<DevPreviewResult>;
  heartbeat(input: {
    spaceInstanceId: string;
    turnId: string;
    elapsedSeconds: number;
  }): Promise<void>;
  progress(input: {
    spaceInstanceId: string;
    turnId: string;
    event: SpaceBuildProgress;
  }): Promise<void>;
  completeChat(input: {
    spaceInstanceId: string;
    turnId: string;
    message: string;
  }): Promise<void>;
  completeRevision(input: {
    spaceInstanceId: string;
    turnId: string;
    summary: string;
    event: SpaceEvent;
  }): Promise<void>;
  failTurn(input: {
    spaceInstanceId: string;
    turnId: string;
    error: unknown;
  }): Promise<void>;
  isRepairableRevisionError(error: unknown): boolean;
  revisionDiagnostics(error: unknown): string;
  reportError(message: string, error: unknown): void;
}

interface LifecycleAttemptResult {
  outcome: "conversation" | "revision";
  summary: string;
  usage?: AgentUsage;
}

interface AuditOptions {
  eventId?: string;
  createdAt?: string;
  session?: AgentSessionRefV1;
}

const heartbeatIntervalMs = 2_000;
const maximumAuditedEvents = 512;
const maximumSummaryCharacters = 4_000;

export class AgentTurnProcessor {
  readonly #dependencies: AgentTurnProcessorDependencies;

  constructor(dependencies: AgentTurnProcessorDependencies) {
    this.#dependencies = dependencies;
  }

  async process(input: {
    agentTurn: AgentTurnInputV1;
  }): Promise<AgentTurnProcessResult> {
    const pinnedTurn = agentTurnInputV1Schema.parse(input.agentTurn);
    const agent = this.#dependencies.getAgent(
      pinnedTurn.definition.adapterKey,
    );
    if (
      !agent
      || agent.adapterKey !== pinnedTurn.definition.adapterKey
      || agent.adapterVersion !== pinnedTurn.definition.adapterVersion
      || !agent.isAvailable()
    ) {
      throw new Error(
        `Agent Adapter ${pinnedTurn.definition.adapterKey}@${pinnedTurn.definition.adapterVersion} is not available`,
      );
    }

    const storedSession = await this.#dependencies.loadAgentSession({
      spaceInstanceId: pinnedTurn.spaceInstanceId,
      agentId: pinnedTurn.agentId,
      sessionId: pinnedTurn.sessionId,
      generation: pinnedTurn.sessionGeneration,
    });
    if (!storedSession || !sessionMatchesTurn(storedSession, pinnedTurn)) {
      throw new Error("The pinned Agent session is unavailable or has changed identity");
    }

    const existing = await this.#dependencies.loadProject(
      pinnedTurn.spaceInstanceId,
    );
    if (
      !existing
      || existing.draftId !== pinnedTurn.project.revisionId
      || existing.sourceHash !== pinnedTurn.project.sourceHash
    ) {
      throw new Error("The pinned Agent Project Revision is unavailable or stale");
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    let activeSession = storedSession;
    let activeLifecycleTurnId = pinnedTurn.turnId;
    let cancelStarted = false;
    let usage: AgentUsage | undefined;
    let auditedEventCount = 0;

    const cancel = async (
      reason: CancelAgentTurnInputV1["reason"],
      requestedAt = new Date().toISOString(),
    ) => {
      if (cancelStarted) return;
      cancelStarted = true;
      const cancelInput: CancelAgentTurnInputV1 = {
        schemaVersion: "vibechat.agent-turn-cancel/v1",
        turnId: activeLifecycleTurnId,
        spaceInstanceId: pinnedTurn.spaceInstanceId,
        agentId: pinnedTurn.agentId,
        sessionId: activeSession.sessionId,
        sessionGeneration: activeSession.generation,
        reason,
        requestedAt,
      };
      await agent.cancel(cancelInput, new AbortController().signal)
        .catch((error) => this.#dependencies.reportError(
          "Agent cancellation notification failed",
          error,
        ));
      controller.abort(new AgentTurnCancelledError(reason));
    };

    const pollControl = async () => {
      if (controller.signal.aborted) return;
      try {
        await this.#dependencies.heartbeat({
          spaceInstanceId: pinnedTurn.spaceInstanceId,
          turnId: pinnedTurn.turnId,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1_000),
        });
        const control = await this.#dependencies.getAgentTurnControl(
          pinnedTurn.spaceInstanceId,
          pinnedTurn.turnId,
        );
        if (control.cancelRequestedAt) {
          await cancel("user_requested", control.cancelRequestedAt);
        } else if (control.status !== "active") {
          await cancel("lease_lost");
        }
      } catch {
        await cancel("lease_lost");
      }
    };
    const heartbeat = setInterval(() => void pollControl(), heartbeatIntervalMs);

    const recordAudit = async (
      eventType: string,
      result: Record<string, unknown>,
      options: AuditOptions = {},
    ) => {
      const auditSession = options.session || activeSession;
      await this.#dependencies.recordAgentAudit(pinnedTurn.turnId, {
        eventId: options.eventId || auditEventId(
          eventType,
          pinnedTurn.turnId,
          auditSession.sessionId,
          String(auditSession.generation),
        ),
        spaceInstanceId: pinnedTurn.spaceInstanceId,
        agentId: pinnedTurn.agentId,
        definitionId: pinnedTurn.definition.definitionId,
        sessionId: auditSession.sessionId,
        eventType,
        policySnapshotHash: pinnedTurn.policy.policySnapshotHash,
        result,
        createdAt: options.createdAt || new Date().toISOString(),
      });
    };

    try {
      await pollControl();
      controller.signal.throwIfAborted();
      activeSession = await this.#restoreOrBeginSession({
        agent,
        pinnedTurn,
        session: activeSession,
        signal: controller.signal,
        recordAudit,
      });

      const projectWorkspace = createAgentProjectWorkspace(
        pinnedTurn.project.revisionId,
        existing.files,
      );
      let completed: LifecycleAttemptResult | undefined;
      let preview: DevPreviewResult | undefined;
      let repairDiagnostics = "";

      for (
        let attempt = 0;
        attempt <= this.#dependencies.maximumRepairs;
        attempt += 1
      ) {
        controller.signal.throwIfAborted();
        activeLifecycleTurnId = attempt === 0
          ? pinnedTurn.turnId
          : `${pinnedTurn.turnId}:repair:${attempt}`;
        const requestText = attempt === 0
          ? pinnedTurn.requestText
          : repairRequest(pinnedTurn.requestText, repairDiagnostics, attempt);
        const attemptInput = agentTurnInputV1Schema.parse({
          ...pinnedTurn,
          turnId: activeLifecycleTurnId,
          sessionId: activeSession.sessionId,
          sessionGeneration: activeSession.generation,
          context: {
            ...pinnedTurn.context,
            summaryRef: activeSession.summaryRef,
          },
          requestText,
        });
        const attemptResult = await this.#runLifecycleAttempt({
          agent,
          originalTurnId: pinnedTurn.turnId,
          input: attemptInput,
          projectWorkspace,
          signal: controller.signal,
          recordAudit: async (event) => {
            auditedEventCount += 1;
            if (auditedEventCount > maximumAuditedEvents) {
              throw new Error(`Agent Turn exceeded ${maximumAuditedEvents} audited events`);
            }
            await recordAudit(
              `agent_event.${event.type}`,
              auditResult(event),
              { eventId: event.eventId, createdAt: event.occurredAt },
            );
          },
        });
        usage = addAgentUsage(usage, attemptResult.usage);

        if (attemptResult.outcome === "conversation") {
          if (attempt > 0) {
            throw new Error("Agent returned a Conversation while repairing a Candidate");
          }
          completed = attemptResult;
          break;
        }

        await this.#dependencies.progress({
          spaceInstanceId: pinnedTurn.spaceInstanceId,
          turnId: pinnedTurn.turnId,
          event: {
            type: "status",
            stage: attempt === 0 ? "developing" : "repairing",
            attempt,
            message: attempt === 0
              ? "正在准备 Space Dev 实时预览…"
              : `正在根据构建诊断自动修复（${attempt}/${this.#dependencies.maximumRepairs}）…`,
          },
        });

        try {
          preview = await this.#dependencies.preparePreview({
            spaceInstanceId: pinnedTurn.spaceInstanceId,
            files: projectWorkspace.snapshot(),
            onStatus: (status) => this.#dependencies.progress({
              spaceInstanceId: pinnedTurn.spaceInstanceId,
              turnId: pinnedTurn.turnId,
              event: {
                type: "status",
                stage: "developing",
                message: status,
              },
            }),
          });
          completed = attemptResult;
          break;
        } catch (error) {
          if (
            !this.#dependencies.isRepairableRevisionError(error)
            || attempt === this.#dependencies.maximumRepairs
          ) throw error;
          repairDiagnostics = this.#dependencies.revisionDiagnostics(error);
          await this.#dependencies.progress({
            spaceInstanceId: pinnedTurn.spaceInstanceId,
            turnId: pinnedTurn.turnId,
            event: {
              type: "status",
              stage: "repairing",
              attempt: attempt + 1,
              message: `开发预览未通过，已把诊断反馈给 ${agent.name}…`,
            },
          });
        }
      }

      if (!completed) throw new Error("Agent lifecycle ended without an outcome");
      if (!hasBillableUsage(usage)) {
        throw new Error("Agent lifecycle completed without billable usage");
      }

      const summarizedAt = new Date().toISOString();
      const summary = await agent.summarize({
        session: activeSession,
        sourceTurnId: pinnedTurn.turnId,
        maxSummaryCharacters: maximumSummaryCharacters,
        requestedAt: summarizedAt,
      }, controller.signal);
      activeSession = agentSessionRefV1Schema.parse({
        ...activeSession,
        summaryRef: summary.summaryRef,
        summaryHash: summary.summaryHash,
        restoreStatus: "ready",
        lastTurnId: pinnedTurn.turnId,
        updatedAt: summarizedAt,
      });
      await this.#dependencies.saveAgentSession(pinnedTurn.turnId, activeSession);
      await recordAudit("agent_session.summarized", {
        generation: activeSession.generation,
        sourceTurnId: pinnedTurn.turnId,
        summaryRef: summary.summaryRef,
        summaryHash: summary.summaryHash,
      });

      if (completed.outcome === "conversation") {
        await this.#dependencies.completeChat({
          spaceInstanceId: pinnedTurn.spaceInstanceId,
          turnId: pinnedTurn.turnId,
          message: completed.summary,
        });
        return {
          succeeded: true,
          usage,
          reply: {
            agentId: pinnedTurn.agentId,
            agentName: agent.name,
            text: completed.summary,
          },
        };
      }

      if (!preview) throw new Error("Agent Revision completed without a ready Candidate");
      const updatedAt = preview.updatedAt;
      await this.#dependencies.saveProject({
        appId: pinnedTurn.spaceInstanceId,
        files: projectWorkspace.snapshot(),
        summary: completed.summary,
        updatedAt,
        draftId: preview.version,
        ...(existing.publishedDraftId
          ? { publishedDraftId: existing.publishedDraftId }
          : {}),
        ...(existing.releaseId ? { releaseId: existing.releaseId } : {}),
        ...(existing.template ? { template: existing.template } : {}),
      });
      await this.#dependencies.completeRevision({
        spaceInstanceId: pinnedTurn.spaceInstanceId,
        turnId: pinnedTurn.turnId,
        summary: completed.summary,
        event: {
          type: "draft_ready",
          message: completed.summary,
          appId: pinnedTurn.spaceInstanceId,
          appUrl: `/apps/${encodeURIComponent(pinnedTurn.spaceInstanceId)}/`,
          devUrl: preview.url,
          version: preview.version,
          updatedAt,
          publishedReleaseId: existing.releaseId ?? null,
        },
      });
      return {
        succeeded: true,
        usage,
        reply: {
          agentId: pinnedTurn.agentId,
          agentName: agent.name,
          text: completed.summary,
        },
      };
    } catch (error) {
      this.#dependencies.reportError("Generation failed", error);
      await this.#dependencies.failTurn({
        spaceInstanceId: pinnedTurn.spaceInstanceId,
        turnId: pinnedTurn.turnId,
        error,
      });
      return { succeeded: false, usage };
    } finally {
      clearInterval(heartbeat);
    }
  }

  async #restoreOrBeginSession(input: {
    agent: CompleteSpaceAgentAdapter;
    pinnedTurn: AgentTurnInputV1;
    session: AgentSessionRefV1;
    signal: AbortSignal;
    recordAudit(
      eventType: string,
      result: Record<string, unknown>,
      options?: AuditOptions,
    ): Promise<void>;
  }) {
    let session = input.session;
    const begin = async () => {
      const requestedAt = new Date().toISOString();
      session = agentSessionRefV1Schema.parse(await input.agent.beginSession({
        definition: input.pinnedTurn.definition,
        session,
        requestedAt,
      }, input.signal));
      await this.#dependencies.saveAgentSession(input.pinnedTurn.turnId, session);
      await input.recordAudit("agent_session.began", {
        generation: session.generation,
        restoreStatus: session.restoreStatus,
        providerSessionAttached: Boolean(session.providerSessionRef),
      }, { session });
      return session;
    };
    const rebuild = async (reason: string) => {
      session = agentSessionRefV1Schema.parse(
        await this.#dependencies.rebuildAgentSession({
          turnId: input.pinnedTurn.turnId,
          session,
        }),
      );
      await input.recordAudit("agent_session.rebuilt", {
        generation: session.generation,
        reason: reason.slice(0, 512),
      }, { session });
      return await begin();
    };

    if (session.restoreStatus === "restoring") return await begin();
    if (
      session.restoreStatus === "rebuild_required"
      || session.restoreStatus === "failed"
      || session.restoreStatus === "closed"
    ) return await rebuild(`session_status:${session.restoreStatus}`);

    const requestedAt = new Date().toISOString();
    const restored = await input.agent.restore({
      definition: input.pinnedTurn.definition,
      session,
      requestedAt,
    }, input.signal);
    session = agentSessionRefV1Schema.parse(restored.session);
    await this.#dependencies.saveAgentSession(input.pinnedTurn.turnId, session);
    await input.recordAudit(`agent_session.${restored.status}`, {
      generation: session.generation,
      restoreStatus: session.restoreStatus,
      ...(restored.status === "rebuild_required"
        ? { reason: restored.reason.slice(0, 512) }
        : {}),
    }, { session });
    return restored.status === "restored"
      ? session
      : await rebuild(restored.reason);
  }

  async #runLifecycleAttempt(input: {
    agent: CompleteSpaceAgentAdapter;
    originalTurnId: string;
    input: AgentTurnInputV1;
    projectWorkspace: ReturnType<typeof createAgentProjectWorkspace>;
    signal: AbortSignal;
    recordAudit(event: AgentEventV1): Promise<void>;
  }): Promise<LifecycleAttemptResult> {
    let expectedSequence = 0;
    let terminal: Extract<AgentEventV1, { type: "completed" | "failed" }> | undefined;
    let usage: AgentUsage | undefined;
    let sawUsageEvent = false;
    const eventIds = new Set<string>();

    for await (const rawEvent of input.agent.runTurn({
      ...input.input,
      projectWorkspace: input.projectWorkspace,
    }, input.signal)) {
      const event = agentEventV1Schema.parse(rawEvent);
      if (
        event.turnId !== input.input.turnId
        || event.sequence !== expectedSequence
        || eventIds.has(event.eventId)
        || terminal
      ) throw new Error("Agent lifecycle emitted an invalid event stream");
      expectedSequence += 1;
      eventIds.add(event.eventId);
      await input.recordAudit(event);

      if (event.type === "status") {
        await this.#dependencies.progress({
          spaceInstanceId: input.input.spaceInstanceId,
          turnId: input.originalTurnId,
          event: {
            type: "status",
            stage: event.stage,
            message: event.message || event.stage,
          },
        });
      } else if (event.type === "text_delta") {
        await this.#dependencies.progress({
          spaceInstanceId: input.input.spaceInstanceId,
          turnId: input.originalTurnId,
          event: { type: "agent_delta", text: event.text },
        });
      } else if (event.type === "tool_activity") {
        await this.#dependencies.progress({
          spaceInstanceId: input.input.spaceInstanceId,
          turnId: input.originalTurnId,
          event: {
            type: "activity",
            label: event.tool,
            status: event.status === "started" ? "in_progress" : event.status,
            toolCallId: event.eventId,
            ...(event.summary ? { path: event.summary } : {}),
          },
        });
      } else if (event.type === "project_patch") {
        await this.#dependencies.progress({
          spaceInstanceId: input.input.spaceInstanceId,
          turnId: input.originalTurnId,
          event: {
            type: "workspace",
            files: input.projectWorkspace.snapshot(),
            ...(event.filesChanged[0]
              ? { changedPath: event.filesChanged[0] }
              : {}),
          },
        });
      } else if (event.type === "usage") {
        sawUsageEvent = true;
        usage = addAgentUsage(usage, unversionUsage(event.usage));
      } else {
        terminal = event;
      }
    }

    if (!terminal) throw new Error("Agent lifecycle ended without one terminal event");
    if (!sawUsageEvent && terminal.usage) {
      usage = addAgentUsage(usage, unversionUsage(terminal.usage));
    }
    if (terminal.type === "failed") throw new AgentLifecycleFailure(terminal.error);
    return {
      outcome: terminal.outcome,
      summary: terminal.summary || "Agent completed the Turn.",
      usage,
    };
  }
}

class AgentLifecycleFailure extends Error {
  constructor(readonly agentError: AgentErrorV1) {
    super(`${agentError.code}: ${boundedDiagnostic(agentError)}`);
    this.name = "AgentLifecycleFailure";
  }
}

class AgentTurnCancelledError extends Error {
  constructor(readonly reason: CancelAgentTurnInputV1["reason"]) {
    super(`Agent Turn was cancelled: ${reason}`);
    this.name = "AgentTurnCancelledError";
  }
}

function sessionMatchesTurn(session: AgentSessionRefV1, turn: AgentTurnInputV1) {
  return session.sessionId === turn.sessionId
    && session.spaceInstanceId === turn.spaceInstanceId
    && session.agentId === turn.agentId
    && session.definitionId === turn.definition.definitionId
    && session.definitionVersion === turn.definition.version
    && session.adapterKey === turn.definition.adapterKey
    && session.adapterVersion === turn.definition.adapterVersion
    && session.generation === turn.sessionGeneration;
}

function unversionUsage(usage: AgentUsageV1): AgentUsage {
  return {
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
  };
}

function hasBillableUsage(usage?: AgentUsage) {
  return Boolean(
    usage
    && (
      (usage.totalTokens ?? 0) > 0
      || (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) > 0
    ),
  );
}

function repairRequest(request: string, diagnostics: string, attempt: number) {
  return [
    request,
    "",
    `Candidate repair attempt ${attempt}. Fix the staged Project using these bounded diagnostics:`,
    diagnostics.slice(0, 2_000),
  ].join("\n");
}

function auditResult(event: AgentEventV1): Record<string, unknown> {
  const base = { sequence: event.sequence };
  if (event.type === "status") {
    return {
      ...base,
      stage: event.stage,
      ...(event.message ? { message: event.message.slice(0, 512) } : {}),
    };
  }
  if (event.type === "text_delta") {
    return { ...base, characters: event.text.length };
  }
  if (event.type === "tool_activity") {
    return {
      ...base,
      tool: event.tool,
      activity: event.activity,
      status: event.status,
      ...(event.summary ? { summary: event.summary.slice(0, 512) } : {}),
    };
  }
  if (event.type === "project_patch") {
    return {
      ...base,
      baseRevisionId: event.baseRevisionId,
      patchRef: event.patchRef,
      sourceHash: event.sourceHash,
      filesChanged: event.filesChanged.slice(0, 64),
      totalFilesChanged: event.filesChanged.length,
    };
  }
  if (event.type === "usage") return { ...base, usage: event.usage };
  if (event.type === "completed") {
    return {
      ...base,
      outcome: event.outcome,
      summary: event.summary.slice(0, 512),
      ...(event.projectRevisionId
        ? { projectRevisionId: event.projectRevisionId }
        : {}),
      ...(event.usage ? { usage: event.usage } : {}),
    };
  }
  return {
    ...base,
    error: {
      code: event.error.code,
      retryable: event.error.retryable,
      sessionAction: event.error.sessionAction,
      billingState: event.error.billingState,
      diagnostics: event.error.diagnostics,
    },
    ...(event.usage ? { usage: event.usage } : {}),
  };
}

function boundedDiagnostic(error: AgentErrorV1) {
  const message = error.diagnostics.message;
  return typeof message === "string"
    ? message.slice(0, 512)
    : "Agent lifecycle failed";
}

function auditEventId(eventType: string, ...identity: string[]) {
  const hash = createHash("sha256")
    .update([eventType, ...identity].join("\n"))
    .digest("hex");
  return `agent-audit:${hash}`;
}
