import { describe, expect, it, vi } from "vitest";
import type { SpaceAgentAdapter } from "../../../apps/space-runtime/src/adapters/contract";
import type { StoredProject } from "../../../apps/space-runtime/src/project-store";
import {
  AgentTurnProcessor,
  type AgentTurnProcessorDependencies,
} from "../../../apps/space-runtime/src/turn-processor/process-agent-turn";

const seedFiles = {
  "package.json": "{}",
  "tsconfig.json": "{}",
  "src/index.ts": "export default {}",
};

function agent(
  overrides: Partial<SpaceAgentAdapter> = {},
): SpaceAgentAdapter {
  return {
    id: "pi",
    name: "Pi",
    isAvailable: () => true,
    runProjectTurn: vi.fn(async () => ({
      kind: "chat" as const,
      message: "Done",
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    })),
    reviseProject: vi.fn(async (input) => ({
      files: input.files,
      summary: "Repaired",
    })),
    ...overrides,
  };
}

function storedProject(): StoredProject {
  return {
    appId: "space-instance-1",
    files: seedFiles,
    sourceHash: `sha256:${"a".repeat(64)}`,
    summary: "Existing",
    updatedAt: "2026-08-26T00:00:00.000Z",
    draftId: "revision-existing",
    publishedDraftId: "revision-published",
    releaseId: "release-1",
  };
}

function dependencies(inputAgent = agent()): AgentTurnProcessorDependencies {
  return {
    maximumRepairs: 3,
    getAgent: vi.fn(() => inputAgent),
    loadProject: vi.fn(async () => null),
    loadSeed: vi.fn(async () => seedFiles),
    saveProject: vi.fn(async () => undefined),
    preparePreview: vi.fn(async () => ({
      version: "revision-ready",
      updatedAt: "2026-08-26T00:01:00.000Z",
      url: "http://space-dev.test/apps/space-instance-1/",
    })),
    heartbeat: vi.fn(async () => undefined),
    progress: vi.fn(async () => undefined),
    completeChat: vi.fn(async () => undefined),
    completeRevision: vi.fn(async () => undefined),
    failTurn: vi.fn(async () => undefined),
    isRepairableRevisionError: vi.fn(() => false),
    revisionDiagnostics: vi.fn(() => "diagnostics"),
    reportError: vi.fn(),
  };
}

const processInput = {
  spaceInstanceId: "space-instance-1",
  turnId: "turn-1",
  message: "Update the Space",
  agentId: "pi",
};

describe("AgentTurnProcessor", () => {
  it("completes a Conversation without preparing a Revision", async () => {
    const inputAgent = agent();
    const input = dependencies(inputAgent);
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process(processInput);

    expect(inputAgent.runProjectTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      request: "Update the Space",
      files: seedFiles,
      onProgress: expect.any(Function),
    });
    expect(result).toEqual({
      succeeded: true,
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
      reply: { agentId: "pi", agentName: "Pi", text: "Done" },
    });
    expect(input.completeChat).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-1",
      message: "Done",
    });
    expect(input.preparePreview).not.toHaveBeenCalled();
  });

  it("saves a ready Revision while preserving published lineage", async () => {
    const revisionFiles = {
      ...seedFiles,
      "src/feature.ts": "export const feature = true",
    };
    const inputAgent = agent({
      runProjectTurn: vi.fn(async () => ({
        kind: "revision",
        files: revisionFiles,
        summary: "Added feature",
        usage: { totalTokens: 7 },
      })),
    });
    const input = dependencies(inputAgent);
    input.loadProject = vi.fn(async () => storedProject());
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process(processInput);

    expect(input.saveProject).toHaveBeenCalledWith({
      appId: "space-instance-1",
      files: revisionFiles,
      summary: "Added feature",
      updatedAt: "2026-08-26T00:01:00.000Z",
      draftId: "revision-ready",
      publishedDraftId: "revision-published",
      releaseId: "release-1",
    });
    expect(input.completeRevision).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-1",
      summary: "Added feature",
      event: expect.objectContaining({
        type: "draft_ready",
        version: "revision-ready",
        publishedReleaseId: "release-1",
      }),
    });
    expect(result).toMatchObject({
      succeeded: true,
      usage: { totalTokens: 7 },
      reply: { text: "Added feature" },
    });
  });

  it("repairs a rejected Candidate and accumulates usage", async () => {
    const candidateFailure = new Error("candidate failed");
    const repairedFiles = {
      ...seedFiles,
      "src/repaired.ts": "export const repaired = true",
    };
    const inputAgent = agent({
      runProjectTurn: vi.fn(async () => ({
        kind: "revision",
        files: seedFiles,
        summary: "Initial revision",
        usage: { inputTokens: 3, totalTokens: 3 },
      })),
      reviseProject: vi.fn(async (revisionInput) => ({
        files: repairedFiles,
        summary: "Repaired revision",
        usage: { outputTokens: 4, totalTokens: 4 },
        diagnostics: revisionInput.diagnostics,
      })),
    });
    const input = dependencies(inputAgent);
    input.isRepairableRevisionError = vi.fn(
      (error) => error === candidateFailure,
    );
    input.revisionDiagnostics = vi.fn(() => "bounded diagnostics");
    input.preparePreview = vi
      .fn()
      .mockRejectedValueOnce(candidateFailure)
      .mockResolvedValueOnce({
        version: "revision-repaired",
        updatedAt: "2026-08-26T00:02:00.000Z",
        url: "http://space-dev.test/apps/space-instance-1/",
      });
    const processor = new AgentTurnProcessor(input);

    const result = await processor.process(processInput);

    expect(inputAgent.reviseProject).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      request: "Update the Space",
      files: seedFiles,
      diagnostics: "bounded diagnostics",
      onProgress: expect.any(Function),
    });
    expect(input.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        files: repairedFiles,
        summary: "Repaired revision",
        draftId: "revision-repaired",
      }),
    );
    expect(result).toMatchObject({
      succeeded: true,
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });
  });

  it("fails a non-repairable Generation without replacing the ready Project", async () => {
    const generationFailure = new Error("provider unavailable");
    const inputAgent = agent({
      runProjectTurn: vi.fn(async () => {
        throw generationFailure;
      }),
    });
    const input = dependencies(inputAgent);
    const processor = new AgentTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toEqual({
      succeeded: false,
      usage: undefined,
    });
    expect(input.reportError).toHaveBeenCalledWith(
      "Generation failed",
      generationFailure,
    );
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-1",
      error: generationFailure,
    });
    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.completeRevision).not.toHaveBeenCalled();
  });

  it("rejects an unavailable Agent before starting Turn side effects", async () => {
    const input = dependencies();
    input.getAgent = vi.fn(() => undefined);
    const processor = new AgentTurnProcessor(input);

    await expect(processor.process(processInput)).rejects.toThrow(
      "Agent pi is not available",
    );
    expect(input.loadProject).not.toHaveBeenCalled();
    expect(input.progress).not.toHaveBeenCalled();
    expect(input.failTurn).not.toHaveBeenCalled();
  });

  it("heartbeats while Agent work is active and stops after completion", async () => {
    vi.useFakeTimers();
    try {
      let completeTurn!: (value: {
        kind: "chat";
        message: string;
      }) => void;
      const pendingTurn = new Promise<{ kind: "chat"; message: string }>(
        (resolve) => {
          completeTurn = resolve;
        },
      );
      const inputAgent = agent({
        runProjectTurn: vi.fn(() => pendingTurn),
      });
      const input = dependencies(inputAgent);
      const processor = new AgentTurnProcessor(input);

      const processing = processor.process(processInput);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(input.heartbeat).toHaveBeenCalledWith({
        spaceInstanceId: "space-instance-1",
        turnId: "turn-1",
        elapsedSeconds: 2,
      });

      completeTurn({ kind: "chat", message: "Done" });
      await processing;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(input.heartbeat).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
