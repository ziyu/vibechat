import { createHash } from "node:crypto";
import type {
  AgentEventV1,
  AgentSessionRefV1,
  AgentUsageV1,
} from "@vibechat/space-agent-contracts";
import type { AgentUsage } from "../../agent-usage.js";
import type { AgentExecutionRuntime } from "../../agent-runtime/contract.js";
import { AgentOsAgentExecutionRuntime } from "../../agent-runtime/agentos/execution-runtime.js";
import type {
  GeneratedRevision,
  CompleteSpaceAgentAdapter,
  GenerationProgress,
  ProjectTurnResult,
  RunAgentTurnInput,
  SpaceAgentTurnInput,
} from "../contract.js";
import { runAgentOsPi } from "./agentos-runner.js";
import { hasModelCredentials, piMode } from "./config.js";
import { runHostPiProjectTurn } from "./host-runner.js";

const defaultExecutionRuntime = new AgentOsAgentExecutionRuntime();

type AgentEventPayload<T> = T extends AgentEventV1
  ? Omit<T, "schemaVersion" | "eventId" | "turnId" | "sequence" | "occurredAt">
  : never;
type LifecycleAgentEventPayload = AgentEventPayload<AgentEventV1>;

export interface LifecycleAgentIdentity {
  id: string;
  name: string;
  adapterKey: string;
  adapterVersion: string;
  providerSessionPrefix: string;
  defaultCompletionMessage: string;
}

export async function runProjectTurn(
  input: SpaceAgentTurnInput,
  executionRuntime: AgentExecutionRuntime = defaultExecutionRuntime,
  signal: AbortSignal = new AbortController().signal,
): Promise<ProjectTurnResult> {
  signal.throwIfAborted();
  if (!hasModelCredentials()) {
    throw new Error(
      "Pi 没有可用的模型凭据。请配置 ANTHROPIC_API_KEY、OPENAI_API_KEY 或其他 Pi 支持的 provider key。",
    );
  }

  const result =
    piMode() === "host"
      ? await runHostPiProjectTurn(input, signal)
      : await runAgentOsPi(input, executionRuntime, signal);
  return classifyProjectTurn(
    input.files,
    result.files,
    result.summary,
    result.usage,
  );
}

export async function reviseProject(
  input: SpaceAgentTurnInput,
  executionRuntime: AgentExecutionRuntime = defaultExecutionRuntime,
): Promise<GeneratedRevision> {
  const turn = await runProjectTurn(input, executionRuntime);
  if (turn.kind === "revision") return turn;
  throw new Error(
    `Pi 没有根据构建诊断修改项目文件：${turn.message.slice(0, 600)}`,
  );
}

export function createPiAgentAdapter(options: {
  executionRuntime?: AgentExecutionRuntime;
  projectTurnRunner?: (
    input: SpaceAgentTurnInput,
    signal: AbortSignal,
  ) => Promise<ProjectTurnResult>;
  restoreMode?: "restored" | "rebuild_required";
  resolveExecutionPoolClass?: (
    definition: RunAgentTurnInput["definition"],
  ) => string | undefined;
} = {}): CompleteSpaceAgentAdapter {
  const executionRuntime = options.executionRuntime ?? defaultExecutionRuntime;
  const projectTurnRunner = options.projectTurnRunner
    ?? ((input, signal) => runProjectTurn(input, executionRuntime, signal));
  return createLifecycleAgentAdapter({
    identity: {
      id: "pi",
      name: "Pi",
      adapterKey: "pi",
      adapterVersion: "0.2.7",
      providerSessionPrefix: "pi-session",
      defaultCompletionMessage: "Pi 已完成本轮处理。",
    },
    projectTurnRunner,
    isAvailable: hasModelCredentials,
    restoreMode: options.restoreMode,
    resolveExecutionPoolClass: options.resolveExecutionPoolClass,
  });
}

export function createLifecycleAgentAdapter(options: {
  identity: LifecycleAgentIdentity;
  projectTurnRunner: (
    input: SpaceAgentTurnInput,
    signal: AbortSignal,
  ) => Promise<ProjectTurnResult>;
  isAvailable: () => boolean;
  restoreMode?: "restored" | "rebuild_required";
  resolveExecutionPoolClass?: (
    definition: RunAgentTurnInput["definition"],
  ) => string | undefined;
}): CompleteSpaceAgentAdapter {
  const activeTurns = new Map<string, AbortController>();
  const cancelledTurns = new Set<string>();
  const { identity, projectTurnRunner } = options;

  return {
    id: identity.id,
    name: identity.name,
    adapterKey: identity.adapterKey,
    adapterVersion: identity.adapterVersion,
    isAvailable: options.isAvailable,
    runProjectTurn: (input) => projectTurnRunner(input, new AbortController().signal),
    async reviseProject(input) {
      const turn = await projectTurnRunner(input, new AbortController().signal);
      if (turn.kind === "revision") return turn;
      throw new Error(
        `${identity.name} did not modify the Project for a repair request: ${turn.message.slice(0, 600)}`,
      );
    },
    async beginSession(input, signal) {
      signal.throwIfAborted();
      assertSessionDefinition(
        input.definition,
        input.session,
        identity,
      );
      return {
        ...input.session,
        providerSessionRef: input.session.providerSessionRef
          || providerSessionRef(identity.providerSessionPrefix, input.session),
        restoreStatus: "ready",
        updatedAt: input.requestedAt,
      };
    },
    runTurn(input, signal) {
      return runLifecycleTurn({
        input,
        signal,
        projectTurnRunner,
        activeTurns,
        cancelledTurns,
        identity,
        executionPoolClass: options.resolveExecutionPoolClass?.(input.definition),
      });
    },
    async summarize(input, signal) {
      signal.throwIfAborted();
      const summaryHash = sha256([
        input.session.spaceInstanceId,
        input.session.agentId,
        input.session.sessionId,
        String(input.session.generation),
        input.sourceTurnId,
        String(input.maxSummaryCharacters),
      ].join("\n"));
      return {
        schemaVersion: "vibechat.agent-session-summary/v1",
        sessionId: input.session.sessionId,
        generation: input.session.generation,
        sourceTurnId: input.sourceTurnId,
        summaryRef: `${identity.providerSessionPrefix}-summary:${summaryHash.slice(-32)}`,
        summaryHash,
        createdAt: input.requestedAt,
      };
    },
    async cancel(input, signal) {
      signal.throwIfAborted();
      const key = lifecycleTurnKey(input);
      cancelledTurns.add(key);
      activeTurns.get(key)?.abort(
        new Error(`${identity.name} Turn cancelled: ${input.reason}`),
      );
    },
    async restore(input, signal) {
      signal.throwIfAborted();
      assertSessionDefinition(
        input.definition,
        input.session,
        identity,
      );
      const rebuildRequired = options.restoreMode === "rebuild_required"
        || (
          options.restoreMode !== "restored"
          && !input.session.providerSessionRef
        );
      if (rebuildRequired) {
        return {
          schemaVersion: "vibechat.agent-session-restore/v1",
          status: "rebuild_required",
          session: {
            ...input.session,
            providerSessionRef: null,
            restoreStatus: "rebuild_required",
            updatedAt: input.requestedAt,
          },
          reason: `The pinned ${identity.name} provider session is unavailable and must be rebuilt.`,
        };
      }
      return {
        schemaVersion: "vibechat.agent-session-restore/v1",
        status: "restored",
        session: {
          ...input.session,
          providerSessionRef: input.session.providerSessionRef
            || providerSessionRef(identity.providerSessionPrefix, input.session),
          restoreStatus: "ready",
          updatedAt: input.requestedAt,
        },
      };
    },
  };
}

async function* runLifecycleTurn(options: {
  input: RunAgentTurnInput;
  signal: AbortSignal;
  projectTurnRunner: (
    input: SpaceAgentTurnInput,
    signal: AbortSignal,
  ) => Promise<ProjectTurnResult>;
  activeTurns: Map<string, AbortController>;
  cancelledTurns: Set<string>;
  identity: LifecycleAgentIdentity;
  executionPoolClass?: string;
}): AsyncIterable<AgentEventV1> {
  const {
    input,
    signal,
    projectTurnRunner,
    activeTurns,
    cancelledTurns,
    identity,
    executionPoolClass,
  } = options;
  const key = lifecycleTurnKey(input);
  const controller = new AbortController();
  const relayAbort = () => controller.abort(signal.reason);
  if (signal.aborted || cancelledTurns.has(key)) {
    controller.abort(signal.reason || new Error(`${identity.name} Turn was cancelled`));
  } else {
    signal.addEventListener("abort", relayAbort, { once: true });
  }
  activeTurns.set(key, controller);

  let sequence = 0;
  const bufferedEvents: AgentEventV1[] = [];
  let wake: (() => void) | undefined;
  let settled = false;
  let result: ProjectTurnResult | undefined;
  let failure: unknown;
  const emit = (
    event: LifecycleAgentEventPayload,
  ) => {
    const value = {
      schemaVersion: "vibechat.agent-event/v1" as const,
      eventId: `${input.turnId}:${sequence}`,
      turnId: input.turnId,
      sequence,
      occurredAt: input.requestedAt,
      ...event,
    } as AgentEventV1;
    sequence += 1;
    bufferedEvents.push(value);
    wake?.();
    wake = undefined;
  };

  emit({
    type: "status",
    stage: "running",
    message: `${identity.name} started the Turn.`,
  });

  void input.projectWorkspace.read()
    .then((files) => projectTurnRunner({
      spaceInstanceId: input.spaceInstanceId,
      ...(executionPoolClass ? { executionPoolClass } : {}),
      request: input.requestText,
      files,
      onProgress: (event) => emitLifecycleProgress(emit, event),
    }, controller.signal))
    .then((value) => {
      result = value;
    })
    .catch((error) => {
      failure = error;
    })
    .finally(() => {
      settled = true;
      wake?.();
      wake = undefined;
    });

  try {
    while (!settled || bufferedEvents.length > 0) {
      if (bufferedEvents.length > 0) {
        yield bufferedEvents.shift()!;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }

    if (controller.signal.aborted || failure || !result) {
      emitLifecycleFailure(
        emit,
        failure || controller.signal.reason,
        controller.signal.aborted,
        identity.name,
      );
    } else {
      const usage = toVersionedUsage(result.usage);
      if (result.kind === "revision") {
        const patch = await input.projectWorkspace.apply(
          input.turnId,
          result.files,
        );
        emit({
          type: "project_patch",
          baseRevisionId: input.project.revisionId,
          ...patch,
        });
      } else if (result.message) {
        emit({
          type: "text_delta",
          text: result.message.slice(0, 16_000),
        });
      }
      if (usage) emit({ type: "usage", usage });
      emit({
        type: "completed",
        outcome: result.kind === "revision" ? "revision" : "conversation",
        summary: (result.kind === "revision" ? result.summary : result.message)
          .slice(0, 4_000),
        ...(result.kind === "revision"
          ? {
              projectRevisionId: `${identity.adapterKey}-revision-${sha256(result.summary).slice(-16)}`,
            }
          : {}),
        ...(usage ? { usage } : {}),
      });
    }

    while (bufferedEvents.length > 0) yield bufferedEvents.shift()!;
  } finally {
    signal.removeEventListener("abort", relayAbort);
    if (activeTurns.get(key) === controller) activeTurns.delete(key);
  }
}

function emitLifecycleProgress(
  emit: (
    event: LifecycleAgentEventPayload,
  ) => void,
  event: GenerationProgress,
) {
  if (event.type === "agent_delta" && event.text) {
    emit({ type: "text_delta", text: event.text.slice(0, 16_000) });
    return;
  }
  if (event.type === "thought") {
    emit({ type: "status", stage: "thinking", message: event.label });
    return;
  }
  if (event.type === "activity") {
    emit({
      type: "tool_activity",
      tool: event.label.slice(0, 128),
      activity: (event.path || event.label).slice(0, 128),
      status: event.status === "completed" || event.status === "failed"
        ? event.status
        : "started",
      ...(event.path ? { summary: event.path.slice(0, 1_000) } : {}),
    });
    return;
  }
  if (event.type === "workspace") {
    emit({
      type: "status",
      stage: "workspace_updated",
      ...(event.changedPath
        ? { message: `${event.changedPath} updated in the staged Project.` }
        : {}),
    });
  }
}

function emitLifecycleFailure(
  emit: (
    event: LifecycleAgentEventPayload,
  ) => void,
  error: unknown,
  cancelled: boolean,
  agentName: string,
) {
  emit({
    type: "failed",
    error: {
      schemaVersion: "vibechat.agent-error/v1",
      code: cancelled ? "AGENT_TURN_CANCELLED" : "AGENT_PROVIDER_FAILED",
      retryable: !cancelled,
      sessionAction: cancelled ? "none" : "retry",
      billingState: "refund_required",
      diagnostics: {
        message: error instanceof Error
          ? error.message.slice(0, 512)
          : `${agentName} failed without a bounded error message`,
      },
    },
  });
}

function assertSessionDefinition(
  definition: Parameters<CompleteSpaceAgentAdapter["beginSession"]>[0]["definition"],
  session: AgentSessionRefV1,
  identity: LifecycleAgentIdentity,
) {
  if (
    definition.agentId !== session.agentId
    || definition.definitionId !== session.definitionId
    || definition.version !== session.definitionVersion
    || definition.adapterKey !== identity.adapterKey
    || session.adapterKey !== identity.adapterKey
    || definition.adapterVersion !== identity.adapterVersion
    || session.adapterVersion !== identity.adapterVersion
  ) {
    throw new Error(`${identity.name} session does not match its pinned Definition`);
  }
}

function providerSessionRef(prefix: string, session: AgentSessionRefV1) {
  return [
    prefix,
    encodeURIComponent(session.spaceInstanceId),
    encodeURIComponent(session.agentId),
    String(session.generation),
  ].join(":");
}

function lifecycleTurnKey(input: {
  turnId: string;
  spaceInstanceId: string;
  agentId: string;
  sessionId: string;
  sessionGeneration: number;
}) {
  return [
    input.spaceInstanceId,
    input.agentId,
    input.sessionId,
    String(input.sessionGeneration),
    input.turnId,
  ].join(":");
}

function toVersionedUsage(usage?: AgentUsage): AgentUsageV1 | undefined {
  return usage ? {
    schemaVersion: "vibechat.agent-usage/v1",
    unit: "tokens",
    ...usage,
  } : undefined;
}

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
}

export function classifyProjectTurn(
  before: SpaceAgentTurnInput["files"],
  after: SpaceAgentTurnInput["files"],
  summary: string,
  usage?: AgentUsage,
  defaultCompletionMessage = "Pi 已完成本轮处理。",
): ProjectTurnResult {
  const message = summary.trim() || defaultCompletionMessage;
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  if ([...paths].some((path) => after[path] !== before[path])) {
    return { kind: "revision", files: after, summary: message, usage };
  }
  return { kind: "chat", message, usage };
}
