import { describe, expect, it, vi } from "vitest";
import { SpaceTurnScheduler } from "../../../apps/space-runtime/src/scheduler/turn-scheduler";

interface TestTurn {
  id: string;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("SpaceTurnScheduler", () => {
  it("coalesces duplicate schedules inside the batch window", async () => {
    const claimTurn = vi.fn(async () => null);
    const executeTurn = vi.fn(async () => undefined);
    const scheduler = new SpaceTurnScheduler<TestTurn>({
      maximumConcurrentTurns: 2,
      turnBatchWindowMs: 0,
      claimTurn,
      executeTurn,
    });

    scheduler.schedule("space-instance-1");
    scheduler.schedule("space-instance-1");

    await vi.waitFor(() => expect(claimTurn).toHaveBeenCalledTimes(1));
    expect(executeTurn).not.toHaveBeenCalled();
  });

  it("limits execution across Spaces to the configured concurrency", async () => {
    const firstCompletion = deferred();
    const secondCompletion = deferred();
    const pendingTurns = new Map<string, TestTurn>([
      ["space-instance-1", { id: "turn-1" }],
      ["space-instance-2", { id: "turn-2" }],
    ]);
    const claimTurn = vi.fn(async (spaceInstanceId: string) => {
      const turn = pendingTurns.get(spaceInstanceId) ?? null;
      pendingTurns.delete(spaceInstanceId);
      return turn;
    });
    const executeTurn = vi.fn(
      async (_spaceInstanceId: string, turn: TestTurn) =>
        turn.id === "turn-1"
          ? firstCompletion.promise
          : secondCompletion.promise,
    );
    const scheduler = new SpaceTurnScheduler<TestTurn>({
      maximumConcurrentTurns: 1,
      turnBatchWindowMs: 0,
      claimTurn,
      executeTurn,
    });

    scheduler.schedule("space-instance-1");
    scheduler.schedule("space-instance-2");

    await vi.waitFor(() => expect(executeTurn).toHaveBeenCalledTimes(1));
    expect(executeTurn).toHaveBeenNthCalledWith(
      1,
      "space-instance-1",
      { id: "turn-1" },
    );

    firstCompletion.resolve();
    await vi.waitFor(() => expect(executeTurn).toHaveBeenCalledTimes(2));
    expect(executeTurn).toHaveBeenNthCalledWith(
      2,
      "space-instance-2",
      { id: "turn-2" },
    );

    secondCompletion.resolve();
  });

  it("claims the next Turn only after the active Turn for a Space completes", async () => {
    const firstCompletion = deferred();
    const secondCompletion = deferred();
    const pendingTurns: TestTurn[] = [{ id: "turn-1" }, { id: "turn-2" }];
    const claimTurn = vi.fn(async () => pendingTurns.shift() ?? null);
    const executeTurn = vi.fn(
      async (_spaceInstanceId: string, turn: TestTurn) =>
        turn.id === "turn-1"
          ? firstCompletion.promise
          : secondCompletion.promise,
    );
    const scheduler = new SpaceTurnScheduler<TestTurn>({
      maximumConcurrentTurns: 2,
      turnBatchWindowMs: 0,
      claimTurn,
      executeTurn,
    });

    scheduler.schedule("space-instance-1");
    await vi.waitFor(() => expect(executeTurn).toHaveBeenCalledTimes(1));

    scheduler.schedule("space-instance-1");
    expect(claimTurn).toHaveBeenCalledTimes(1);

    firstCompletion.resolve();
    await vi.waitFor(() => expect(executeTurn).toHaveBeenCalledTimes(2));
    expect(executeTurn).toHaveBeenNthCalledWith(
      2,
      "space-instance-1",
      { id: "turn-2" },
    );

    secondCompletion.resolve();
    await vi.waitFor(() => expect(claimTurn).toHaveBeenCalledTimes(3));
  });

  it("stops safely when no Turn can be claimed", async () => {
    const claimTurn = vi.fn(async () => null);
    const executeTurn = vi.fn(async () => undefined);
    const scheduler = new SpaceTurnScheduler<TestTurn>({
      maximumConcurrentTurns: 1,
      turnBatchWindowMs: 0,
      claimTurn,
      executeTurn,
    });

    scheduler.schedule("space-instance-empty");

    await vi.waitFor(() => expect(claimTurn).toHaveBeenCalledTimes(1));
    expect(executeTurn).not.toHaveBeenCalled();
  });
});
