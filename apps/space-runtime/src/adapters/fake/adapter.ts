import { createHash } from "node:crypto";
import type {
  AgentDefinitionSnapshot,
  AgentEventV1,
  AgentSessionRefV1,
  AgentUsageV1,
} from "@vibechat/space-agent-contracts";
import type { AgentUsage } from "../../agent-usage.js";
import type {
  AgentProjectPatch,
  CompleteSpaceAgentAdapter,
} from "../contract.js";

const DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
}

function providerSessionRef(session: AgentSessionRefV1) {
  return [
    "fake-session",
    encodeURIComponent(session.spaceInstanceId),
    encodeURIComponent(session.agentId),
    String(session.generation),
  ].join(":");
}

function assertSessionDefinition(
  definition: AgentDefinitionSnapshot,
  session: AgentSessionRefV1,
  adapterKey: string,
  adapterVersion: string,
) {
  if (
    session.agentId !== definition.agentId
    || session.definitionId !== definition.definitionId
    || session.definitionVersion !== definition.version
    || session.adapterKey !== adapterKey
    || session.adapterVersion !== adapterVersion
  ) {
    throw new Error("Fake Agent session does not match its pinned Definition");
  }
}

export function createFakeAgentAdapter(options: {
  id?: string;
  name?: string;
  usage?: AgentUsage;
  adapterKey?: string;
  adapterVersion?: string;
  restoreMode?: "restored" | "rebuild_required";
} = {}): CompleteSpaceAgentAdapter {
  const id = options.id || "fake";
  const name = options.name || "Fake Agent";
  const adapterKey = options.adapterKey || "fake";
  const adapterVersion = options.adapterVersion || "1.0.0";
  const restoreMode = options.restoreMode || "restored";
  const usage = options.usage || {
    inputTokens: 8,
    outputTokens: 5,
    totalTokens: 13,
  };
  const versionedUsage: AgentUsageV1 = {
    schemaVersion: "vibechat.agent-usage/v1",
    unit: "tokens",
    ...usage,
  };
  const cancelledTurns = new Set<string>();

  const turnKey = (
    turnId: string,
    spaceInstanceId: string,
    agentId: string,
    sessionId: string,
    generation: number,
  ) => (
    `${spaceInstanceId}:${agentId}:${sessionId}:${generation}:${turnId}`
  );

  const terminalFailure = (
    input: Parameters<CompleteSpaceAgentAdapter["runTurn"]>[0],
    sequence: number,
    code: string,
    diagnostics: Record<string, string | number | boolean | null>,
  ): AgentEventV1 => ({
    schemaVersion: "vibechat.agent-event/v1",
    eventId: `${input.turnId}:${sequence}`,
    turnId: input.turnId,
    sequence,
    occurredAt: input.requestedAt,
    type: "failed",
    error: {
      schemaVersion: "vibechat.agent-error/v1",
      code,
      retryable: false,
      sessionAction: "none",
      billingState: "refund_required",
      diagnostics,
    },
  });

  return {
    id,
    name,
    adapterKey,
    adapterVersion,
    isAvailable: () => true,
    async runProjectTurn(input) {
      await input.onProgress?.({
        type: "agent_delta",
        text: `${name} received: ${input.request}`,
      });
      if (input.request.includes("[fake:failure]")) {
        return {
          kind: "revision",
          files: {
            ...input.files,
            "src/fake-agent-failure.ts": "export const deterministicCandidateFailure = ;\n",
          },
          summary: `${name} created a deterministic failing revision.`,
          usage,
        };
      }
      if (input.request.includes("[fake:revision]")) {
        return {
          kind: "revision",
          files: {
            ...input.files,
            "src/fake-agent-note.ts": `export const note = ${JSON.stringify(input.request)};\n`,
          },
          summary: `${name} created a deterministic revision.`,
          usage,
        };
      }
      return {
        kind: "chat",
        message: `${name} received: ${input.request}`,
        usage,
      };
    },
    async reviseProject(input) {
      return {
        files: {
          ...input.files,
          "src/fake-agent-repair.ts": `export const diagnostics = ${JSON.stringify(input.diagnostics || "")};\n`,
        },
        summary: `${name} created a deterministic repair.`,
        usage,
      };
    },
    async beginSession(input, signal) {
      signal.throwIfAborted();
      assertSessionDefinition(
        input.definition,
        input.session,
        adapterKey,
        adapterVersion,
      );
      return {
        ...input.session,
        providerSessionRef: input.session.providerSessionRef
          || providerSessionRef(input.session),
        restoreStatus: "ready",
        updatedAt: input.requestedAt,
      };
    },
    async *runTurn(input, signal) {
      let sequence = 0;
      const key = turnKey(
        input.turnId,
        input.spaceInstanceId,
        input.agentId,
        input.sessionId,
        input.sessionGeneration,
      );
      const isCancelled = () => signal.aborted || cancelledTurns.has(key);
      const cancellationEvent = () => terminalFailure(
        input,
        sequence,
        "AGENT_TURN_CANCELLED",
        { reason: signal.aborted ? "abort_signal" : "cancel_requested" },
      );

      if (isCancelled()) {
        yield cancellationEvent();
        return;
      }

      yield {
        schemaVersion: "vibechat.agent-event/v1",
        eventId: `${input.turnId}:${sequence}`,
        turnId: input.turnId,
        sequence,
        occurredAt: input.requestedAt,
        type: "status",
        stage: "running",
        message: `${name} started the Turn.`,
      };
      sequence += 1;

      if (isCancelled()) {
        yield cancellationEvent();
        return;
      }

      if (input.requestText.includes("[fake:lifecycle-failure]")) {
        yield terminalFailure(
          input,
          sequence,
          "FAKE_PROVIDER_FAILURE",
          { adapter: adapterKey },
        );
        return;
      }

      const revisionRequested = input.requestText.includes("[fake:revision]");
      let projectPatch: AgentProjectPatch | undefined;
      if (revisionRequested) {
        yield {
          schemaVersion: "vibechat.agent-event/v1",
          eventId: `${input.turnId}:${sequence}`,
          turnId: input.turnId,
          sequence,
          occurredAt: input.requestedAt,
          type: "tool_activity",
          tool: "project.patch",
          activity: "apply",
          status: "completed",
          summary: "Applied a deterministic fake Project patch.",
        };
        sequence += 1;

        if (isCancelled()) {
          yield cancellationEvent();
          return;
        }

        const files = await input.projectWorkspace.read();
        projectPatch = await input.projectWorkspace.apply(input.turnId, {
          ...files,
          "src/fake-agent-note.ts": `export const note = ${JSON.stringify(input.requestText)};\n`,
        });
        yield {
          schemaVersion: "vibechat.agent-event/v1",
          eventId: `${input.turnId}:${sequence}`,
          turnId: input.turnId,
          sequence,
          occurredAt: input.requestedAt,
          type: "project_patch",
          baseRevisionId: input.project.revisionId,
          ...projectPatch,
        };
        sequence += 1;
      } else {
        yield {
          schemaVersion: "vibechat.agent-event/v1",
          eventId: `${input.turnId}:${sequence}`,
          turnId: input.turnId,
          sequence,
          occurredAt: input.requestedAt,
          type: "text_delta",
          text: `${name} received: ${input.requestText}`.slice(0, 16_000),
        };
        sequence += 1;
      }

      if (isCancelled()) {
        yield cancellationEvent();
        return;
      }

      if (!input.requestText.includes("[fake:missing-usage]")) {
        yield {
          schemaVersion: "vibechat.agent-event/v1",
          eventId: `${input.turnId}:${sequence}`,
          turnId: input.turnId,
          sequence,
          occurredAt: input.requestedAt,
          type: "usage",
          usage: versionedUsage,
        };
        sequence += 1;
      }

      if (isCancelled()) {
        yield cancellationEvent();
        return;
      }

      const revisionId = revisionRequested
        ? `fake-revision-${projectPatch!.sourceHash.slice(-16)}`
        : undefined;
      const hasUsage = !input.requestText.includes("[fake:missing-usage]");
      yield {
        schemaVersion: "vibechat.agent-event/v1",
        eventId: `${input.turnId}:${sequence}`,
        turnId: input.turnId,
        sequence,
        occurredAt: input.requestedAt,
        type: "completed",
        outcome: revisionRequested ? "revision" : "conversation",
        summary: `${name} completed: ${input.requestText}`.slice(0, 4_000),
        projectRevisionId: revisionId,
        ...(hasUsage ? { usage: versionedUsage } : {}),
      };
    },
    async summarize(input, signal) {
      signal.throwIfAborted();
      const summaryIdentity = [
        input.session.spaceInstanceId,
        input.session.agentId,
        input.session.sessionId,
        String(input.session.generation),
        input.sourceTurnId,
        String(input.maxSummaryCharacters),
      ].join("\n");
      const summaryHash = sha256(summaryIdentity);
      return {
        schemaVersion: "vibechat.agent-session-summary/v1",
        sessionId: input.session.sessionId,
        generation: input.session.generation,
        sourceTurnId: input.sourceTurnId,
        summaryRef: `fake-summary:${summaryHash.slice(-32)}`,
        summaryHash,
        createdAt: input.requestedAt || DEFAULT_TIMESTAMP,
      };
    },
    async cancel(input, signal) {
      signal.throwIfAborted();
      cancelledTurns.add(turnKey(
        input.turnId,
        input.spaceInstanceId,
        input.agentId,
        input.sessionId,
        input.sessionGeneration,
      ));
    },
    async restore(input, signal) {
      signal.throwIfAborted();
      assertSessionDefinition(
        input.definition,
        input.session,
        adapterKey,
        adapterVersion,
      );
      if (restoreMode === "rebuild_required") {
        return {
          schemaVersion: "vibechat.agent-session-restore/v1",
          status: "rebuild_required",
          session: {
            ...input.session,
            providerSessionRef: null,
            restoreStatus: "rebuild_required",
            updatedAt: input.requestedAt,
          },
          reason: "The deterministic fake provider session cannot be restored.",
        };
      }
      return {
        schemaVersion: "vibechat.agent-session-restore/v1",
        status: "restored",
        session: {
          ...input.session,
          providerSessionRef: input.session.providerSessionRef
            || providerSessionRef(input.session),
          restoreStatus: "ready",
          updatedAt: input.requestedAt,
        },
      };
    },
  };
}
