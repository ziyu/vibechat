import { describe, expect, it, vi } from "vitest";
import type {
  AgentEventV1,
  AgentSessionRefV1,
  AgentTurnInputV1,
} from "../../../packages/space-agent-contracts/src";
import {
  createFakeAgentAdapter,
} from "../../../apps/space-runtime/src/adapters/fake/adapter";
import type {
  CompleteSpaceAgentAdapter,
} from "../../../apps/space-runtime/src/adapters/contract";
import type { StoredProject } from "../../../apps/space-runtime/src/project-store";
import {
  AgentTurnProcessor,
  type AgentTurnProcessorDependencies,
} from "../../../apps/space-runtime/src/turn-processor/process-agent-turn";

const timestamp = "2026-08-27T00:00:00.000Z";
const sourceHash = `sha256:${"a".repeat(64)}` as const;
const seedFiles = {
  "package.json": "{}",
  "tsconfig.json": "{}",
  "src/index.ts": "export default {}",
};

function session(
  restoreStatus: AgentSessionRefV1["restoreStatus"] = "restoring",
): AgentSessionRefV1 {
  return {
    schemaVersion: "vibechat.agent-session-ref/v1",
    sessionId: "session-1",
    spaceInstanceId: "space-instance-1",
    agentId: "fake",
    definitionId: "definition-fake",
    definitionVersion: "1.0.0",
    adapterKey: "fake",
    adapterVersion: "1.0.0",
    generation: 1,
    providerSessionRef: restoreStatus === "ready" ? "fake-session:space:fake:1" : null,
    summaryRef: null,
    summaryHash: null,
    region: "local",
    restoreStatus,
    lastTurnId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function agentTurn(requestText = "Answer the member"): AgentTurnInputV1 {
  return {
    schemaVersion: "vibechat.agent-turn-input/v1",
    turnId: "turn-1",
    spaceInstanceId: "space-instance-1",
    agentId: "fake",
    sessionId: "session-1",
    sessionGeneration: 1,
    definition: {
      definitionId: "definition-fake",
      agentId: "fake",
      version: "1.0.0",
      adapterKey: "fake",
      adapterVersion: "1.0.0",
      provider: "fake",
      model: "deterministic",
      capabilities: ["conversation", "project_patch"],
      toolPolicyId: "tool-policy-default",
      pricingPolicyId: "pricing-policy-default",
      usageSchemaVersion: "vibechat.agent-usage/v1",
      maxBudgetCredits: 100,
      maxConcurrency: 1,
      dataRegionPolicy: { mode: "any", regions: [] },
      displayName: "Fake Agent",
      description: "Deterministic Agent",
      status: "active",
      availability: "available",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    policy: {
      schemaVersion: "vibechat.agent-policy/v1",
      policySnapshotHash: sourceHash,
      permissionPolicyId: "permission-policy-default",
      toolPolicyId: "tool-policy-default",
      pricingPolicyId: "pricing-policy-default",
      maxCredits: 100,
      maxInputTokens: 16_000,
      maxOutputTokens: 4_000,
      allowedTools: ["project.patch"],
    },
    context: {
      matrixEventIds: ["$event-1"],
      messageWindowRef: null,
      summaryRef: null,
    },
    project: {
      projectId: "project-1",
      revisionId: "revision-existing",
      sourceHash,
    },
    requestText,
    requestedAt: timestamp,
  };
}

function storedProject(): StoredProject {
  return {
    appId: "space-instance-1",
    files: seedFiles,
    sourceHash,
    summary: "Existing",
    updatedAt: timestamp,
    draftId: "revision-existing",
    publishedDraftId: "revision-published",
    releaseId: "release-1",
  };
}

function dependencies(
  adapter: CompleteSpaceAgentAdapter = createFakeAgentAdapter(),
  initialSession = session(),
): AgentTurnProcessorDependencies {
  let currentSession = initialSession;
  return {
    maximumRepairs: 3,
    getAgent: vi.fn(() => adapter),
    loadProject: vi.fn(async () => storedProject()),
    saveProject: vi.fn(async () => undefined),
    loadAgentSession: vi.fn(async () => currentSession),
    saveAgentSession: vi.fn(async (_turnId, nextSession) => {
      currentSession = nextSession;
    }),
    rebuildAgentSession: vi.fn(async ({ session: previous }) => {
      if (currentSession.generation > previous.generation) return currentSession;
      currentSession = {
        ...previous,
        sessionId: "session-2",
        generation: previous.generation + 1,
        providerSessionRef: null,
        restoreStatus: "restoring",
        createdAt: "2026-08-27T00:01:00.000Z",
        updatedAt: "2026-08-27T00:01:00.000Z",
      };
      return currentSession;
    }),
    recordAgentAudit: vi.fn(async () => undefined),
    getAgentTurnControl: vi.fn(async () => ({
      status: "active" as const,
      cancelRequestedAt: null,
    })),
    preparePreview: vi.fn(async () => ({
      version: "revision-ready",
      updatedAt: "2026-08-27T00:02:00.000Z",
      url: "http://space-dev.test/apps/space-instance-1/",
    })),
    heartbeat: vi.fn(async () => undefined),
    progress: vi.fn(async () => undefined),
    completeChat: vi.fn(async () => undefined),
    completeRevision: vi.fn(async () => undefined),
    failTurn: vi.fn(async () => undefined),
    isRepairableRevisionError: vi.fn(() => false),
    revisionDiagnostics: vi.fn(() => "bounded diagnostics"),
    reportError: vi.fn(),
  };
}

describe("AgentTurnProcessor S4 lifecycle", () => {
  it("begins, audits, summarizes, and persists a Conversation session", async () => {
    const input = dependencies();
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process({ agentTurn: agentTurn() });

    expect(result).toMatchObject({
      succeeded: true,
      usage: { inputTokens: 8, outputTokens: 5, totalTokens: 13 },
      reply: { agentId: "fake", agentName: "Fake Agent" },
    });
    expect(input.completeChat).toHaveBeenCalledWith(expect.objectContaining({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-1",
      message: expect.stringContaining("Answer the member"),
    }));
    expect(input.preparePreview).not.toHaveBeenCalled();
    expect(input.saveAgentSession).toHaveBeenLastCalledWith(
      "turn-1",
      expect.objectContaining({
        restoreStatus: "ready",
        lastTurnId: "turn-1",
        summaryRef: expect.any(String),
        summaryHash: expect.stringMatching(/^sha256:/),
      }),
    );
    const audits = vi.mocked(input.recordAgentAudit).mock.calls
      .map(([, event]) => event);
    expect(audits.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "agent_session.began",
      "agent_event.status",
      "agent_event.text_delta",
      "agent_event.usage",
      "agent_event.completed",
      "agent_session.summarized",
    ]));
    expect(audits.find((event) => event.eventType === "agent_event.text_delta")?.result)
      .toEqual({ sequence: 1, characters: expect.any(Number) });
  });

  it("saves a ready Revision while preserving published lineage", async () => {
    const input = dependencies();
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process({
      agentTurn: agentTurn("[fake:revision] add a note"),
    });

    expect(input.saveProject).toHaveBeenCalledWith(expect.objectContaining({
      appId: "space-instance-1",
      files: expect.objectContaining({
        "src/fake-agent-note.ts": expect.stringContaining("add a note"),
      }),
      draftId: "revision-ready",
      publishedDraftId: "revision-published",
      releaseId: "release-1",
    }));
    expect(input.completeRevision).toHaveBeenCalledWith(expect.objectContaining({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-1",
      event: expect.objectContaining({
        type: "draft_ready",
        version: "revision-ready",
        publishedReleaseId: "release-1",
      }),
    }));
    expect(result).toMatchObject({ succeeded: true, usage: { totalTokens: 13 } });
  });

  it("runs a lifecycle repair attempt and accumulates usage", async () => {
    const candidateFailure = new Error("candidate failed");
    const input = dependencies();
    input.isRepairableRevisionError = vi.fn((error) => error === candidateFailure);
    input.revisionDiagnostics = vi.fn(() => "bounded compiler diagnostics");
    input.preparePreview = vi.fn()
      .mockRejectedValueOnce(candidateFailure)
      .mockResolvedValueOnce({
        version: "revision-repaired",
        updatedAt: "2026-08-27T00:03:00.000Z",
        url: "http://space-dev.test/apps/space-instance-1/",
      });
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process({
      agentTurn: agentTurn("[fake:revision] add a note"),
    });

    expect(result).toMatchObject({
      succeeded: true,
      usage: { inputTokens: 16, outputTokens: 10, totalTokens: 26 },
    });
    expect(input.preparePreview).toHaveBeenCalledTimes(2);
    expect(input.saveProject).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.objectContaining({
        "src/fake-agent-note.ts": expect.stringContaining("bounded compiler diagnostics"),
      }),
      draftId: "revision-repaired",
    }));
    const eventIds = vi.mocked(input.recordAgentAudit).mock.calls
      .map(([, event]) => event.eventId);
    expect(new Set(eventIds).size).toBe(eventIds.length);
  });

  it("restores or rebuilds the pinned session before running", async () => {
    const adapter = createFakeAgentAdapter({ restoreMode: "rebuild_required" });
    const input = dependencies(adapter, session("ready"));
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process({ agentTurn: agentTurn() });

    expect(result.succeeded).toBe(true);
    expect(input.rebuildAgentSession).toHaveBeenCalledWith({
      turnId: "turn-1",
      session: expect.objectContaining({
        sessionId: "session-1",
        restoreStatus: "rebuild_required",
      }),
    });
    expect(input.saveAgentSession).toHaveBeenLastCalledWith(
      "turn-1",
      expect.objectContaining({
        sessionId: "session-2",
        generation: 2,
        restoreStatus: "ready",
        lastTurnId: "turn-1",
      }),
    );
  });

  it("fails a provider terminal event without replacing the ready Project", async () => {
    const input = dependencies();
    const processor = new AgentTurnProcessor(input);

    await expect(processor.process({
      agentTurn: agentTurn("[fake:lifecycle-failure]"),
    })).resolves.toEqual({ succeeded: false, usage: undefined });
    expect(input.failTurn).toHaveBeenCalledWith(expect.objectContaining({
      turnId: "turn-1",
      error: expect.objectContaining({ name: "AgentLifecycleFailure" }),
    }));
    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.completeRevision).not.toHaveBeenCalled();
  });

  it("treats missing usage as failure so existing billing refunds", async () => {
    const input = dependencies();
    const processor = new AgentTurnProcessor(input);

    await expect(processor.process({
      agentTurn: agentTurn("[fake:missing-usage]"),
    })).resolves.toEqual({ succeeded: false, usage: undefined });
    expect(input.failTurn).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: "Agent lifecycle completed without billable usage",
      }),
    }));
    expect(input.completeChat).not.toHaveBeenCalled();
  });

  it("observes persisted cancel state and aborts the isolated Adapter turn", async () => {
    vi.useFakeTimers();
    try {
      const base = createFakeAgentAdapter();
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const runTurn = vi.fn(async function* (
        turn: Parameters<CompleteSpaceAgentAdapter["runTurn"]>[0],
        signal: AbortSignal,
      ): AsyncIterable<AgentEventV1> {
        markStarted();
        yield event(turn, 0, { type: "status", stage: "running" });
        await new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });
        yield event(turn, 1, {
          type: "failed",
          error: {
            schemaVersion: "vibechat.agent-error/v1",
            code: "AGENT_TURN_CANCELLED",
            retryable: false,
            sessionAction: "none",
            billingState: "refund_required",
            diagnostics: { reason: "cancel_requested" },
          },
        });
      });
      const cancel = vi.fn(base.cancel.bind(base));
      const adapter: CompleteSpaceAgentAdapter = { ...base, runTurn, cancel };
      const input = dependencies(adapter);
      input.getAgentTurnControl = vi.fn()
        .mockResolvedValueOnce({ status: "active", cancelRequestedAt: null })
        .mockResolvedValue({
          status: "active",
          cancelRequestedAt: "2026-08-27T00:04:00.000Z",
        });
      const processor = new AgentTurnProcessor(input);

      const processing = processor.process({ agentTurn: agentTurn() });
      await started;
      await vi.advanceTimersByTimeAsync(2_000);
      const result = await processing;

      expect(result.succeeded).toBe(false);
      expect(cancel).toHaveBeenCalledWith(expect.objectContaining({
        turnId: "turn-1",
        spaceInstanceId: "space-instance-1",
        agentId: "fake",
        sessionId: "session-1",
        sessionGeneration: 1,
        reason: "user_requested",
      }), expect.any(AbortSignal));
      expect(input.failTurn).toHaveBeenCalled();
      const heartbeatCalls = vi.mocked(input.heartbeat).mock.calls.length;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(input.heartbeat).toHaveBeenCalledTimes(heartbeatCalls);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects unavailable Adapters and stale Project/session identities", async () => {
    const unavailable = dependencies();
    unavailable.getAgent = vi.fn(() => undefined);
    await expect(new AgentTurnProcessor(unavailable).process({
      agentTurn: agentTurn(),
    })).rejects.toThrow("Agent Adapter fake@1.0.0 is not available");
    expect(unavailable.loadAgentSession).not.toHaveBeenCalled();

    const stale = dependencies();
    stale.loadProject = vi.fn(async () => ({
      ...storedProject(),
      draftId: "another-revision",
    }));
    await expect(new AgentTurnProcessor(stale).process({
      agentTurn: agentTurn(),
    })).rejects.toThrow("pinned Agent Project Revision is unavailable or stale");
    expect(stale.completeChat).not.toHaveBeenCalled();
  });
});

function event(
  turn: Parameters<CompleteSpaceAgentAdapter["runTurn"]>[0],
  sequence: number,
  payload: Record<string, unknown>,
): AgentEventV1 {
  return {
    schemaVersion: "vibechat.agent-event/v1",
    eventId: `${turn.turnId}:${sequence}`,
    turnId: turn.turnId,
    sequence,
    occurredAt: turn.requestedAt,
    ...payload,
  } as AgentEventV1;
}
