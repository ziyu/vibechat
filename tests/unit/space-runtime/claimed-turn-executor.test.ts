import { describe, expect, it, vi } from "vitest";
import {
  ClaimedTurnExecutor,
  type ClaimedTurnExecutorDependencies,
} from "../../../apps/space-runtime/src/scheduler/claimed-turn-executor";
import type {
  ClaimedSpaceTurn,
  SpaceTurnKind,
  SpaceTurnRequest,
} from "../../../apps/space-runtime/src/space-instance-server";

function claimedTurn(
  kind: SpaceTurnKind = "message",
  requestOverrides: Partial<SpaceTurnRequest> = {},
): ClaimedSpaceTurn {
  return {
    turnId: `turn-${kind}`,
    kind,
    requests: [
      {
        turnId: `turn-${kind}`,
        kind,
        clientId: "member-1",
        authorName: "Member One",
        text: "Update the Space",
        createdAt: "2026-08-26T00:00:00.000Z",
        externalRequestId: `$event-${kind}`,
        agentId: "pi",
        ...requestOverrides,
      },
    ],
  };
}

function dependencies(
  overrides: Partial<ClaimedTurnExecutorDependencies> = {},
): ClaimedTurnExecutorDependencies {
  return {
    defaultAgentId: "pi-default",
    executeAgentTurn: vi.fn(async () => ({ succeeded: true })),
    executePublishTurn: vi.fn(async () => true),
    executeRestoreTurn: vi.fn(async () => true),
    failTurn: vi.fn(async () => undefined),
    reportBilling: vi.fn(async () => undefined),
    reportCompletion: vi.fn(async () => undefined),
    reportError: vi.fn(),
    ...overrides,
  };
}

describe("ClaimedTurnExecutor", () => {
  it("executes an Agent Turn and reports billing plus one completion", async () => {
    const turn = claimedTurn("message", { agentId: "" });
    const usage = { inputTokens: 7, outputTokens: 5, totalTokens: 12 };
    const reply = { agentId: "pi", agentName: "Pi", text: "Done" };
    const executeAgentTurn = vi.fn(async () => ({
      succeeded: true,
      usage,
      reply,
    }));
    const input = dependencies({ executeAgentTurn });
    const executor = new ClaimedTurnExecutor(input);

    await executor.execute("space-instance-1", turn);

    expect(executeAgentTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turn,
      agentId: "pi-default",
    });
    expect(input.reportBilling).toHaveBeenCalledWith({
      turn,
      status: "completed",
      usage,
    });
    expect(input.reportCompletion).toHaveBeenCalledWith({ turn, reply });
    expect(input.failTurn).not.toHaveBeenCalled();
  });

  it("dispatches Publish and Restore Turns without invoking an Agent", async () => {
    const publishTurn = claimedTurn("publish", {
      publication: { expectedReadyRevisionId: "revision-ready-1" },
    });
    const restoreTurn = claimedTurn("restore", {
      recovery: {
        target: "default-chat",
        expectedReadyRevisionId: "revision-ready-2",
      },
    });
    const input = dependencies();
    const executor = new ClaimedTurnExecutor(input);

    await executor.execute("space-instance-1", publishTurn);
    await executor.execute("space-instance-1", restoreTurn);

    expect(input.executePublishTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish",
      expectedReadyRevisionId: "revision-ready-1",
    });
    expect(input.executeRestoreTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore",
      recovery: {
        target: "default-chat",
        expectedReadyRevisionId: "revision-ready-2",
      },
    });
    expect(input.executeAgentTurn).not.toHaveBeenCalled();
    expect(input.reportCompletion).not.toHaveBeenCalled();
    expect(input.reportBilling).toHaveBeenNthCalledWith(1, {
      turn: publishTurn,
      status: "completed",
      usage: undefined,
    });
    expect(input.reportBilling).toHaveBeenNthCalledWith(2, {
      turn: restoreTurn,
      status: "completed",
      usage: undefined,
    });
  });

  it("fails the Turn and reports failed billing when processing throws", async () => {
    const turn = claimedTurn();
    const failure = new Error("processor failed");
    const input = dependencies({
      executeAgentTurn: vi.fn(async () => {
        throw failure;
      }),
    });
    const executor = new ClaimedTurnExecutor(input);

    await executor.execute("space-instance-1", turn);

    expect(input.reportError).toHaveBeenCalledWith("Queued turn failed", failure);
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-message",
      error: failure,
    });
    expect(input.reportBilling).toHaveBeenCalledWith({
      turn,
      status: "failed",
      usage: undefined,
    });
    expect(input.reportCompletion).not.toHaveBeenCalled();
  });

  it("routes missing Publish metadata through the existing failure path", async () => {
    const turn = claimedTurn("publish");
    const input = dependencies();
    const executor = new ClaimedTurnExecutor(input);

    await executor.execute("space-instance-1", turn);

    expect(input.executePublishTurn).not.toHaveBeenCalled();
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish",
      error: expect.objectContaining({
        message: "Space publish request is missing revision metadata",
      }),
    });
    expect(input.reportBilling).toHaveBeenCalledWith({
      turn,
      status: "failed",
      usage: undefined,
    });
  });

  it("contains billing and completion callback failures after a successful Turn", async () => {
    const turn = claimedTurn();
    const billingFailure = new Error("billing unavailable");
    const completionFailure = new Error("completion unavailable");
    const input = dependencies({
      executeAgentTurn: vi.fn(async () => ({
        succeeded: true,
        reply: { agentId: "pi", agentName: "Pi", text: "Done" },
      })),
      reportBilling: vi.fn(async () => {
        throw billingFailure;
      }),
      reportCompletion: vi.fn(async () => {
        throw completionFailure;
      }),
    });
    const executor = new ClaimedTurnExecutor(input);

    await expect(
      executor.execute("space-instance-1", turn),
    ).resolves.toBeUndefined();
    expect(input.reportError).toHaveBeenCalledWith(
      "Space turn billing callback failed",
      billingFailure,
    );
    expect(input.reportError).toHaveBeenCalledWith(
      "Space turn completion callback failed",
      completionFailure,
    );
    expect(input.failTurn).not.toHaveBeenCalled();
  });
});
