import { existsSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/vibechat-space-runtime-control-${process.pid}-${Date.now()}.sqlite`;
let database: typeof import("@libs/database");
let now = new Date("2026-08-26T00:00:00.000Z");
let control: import("@libs/space-runtime-control").DatabaseSpaceRuntimeControlPlane;

beforeAll(async () => {
  process.env.DB_DIALECT = "sqlite";
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();
  database = await import("@libs/database");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { DatabaseSpaceRuntimeControlPlane } = await import("@libs/space-runtime-control");
  migrate(database.db as never, { migrationsFolder: "libs/database/drizzle-sqlite" });
  control = new DatabaseSpaceRuntimeControlPlane(() => new Date(now));
});

afterAll(() => {
  database.sqliteInstance?.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  delete process.env.SQLITE_DB_PATH;
  delete process.env.DB_DIALECT;
});

describe("durable Space Runtime control plane", () => {
  it("persists the pinned Agent snapshot and does not overwrite it on event retry", async () => {
    const original = await control.enqueueTurn({
      turnId: "turn-pinned-snapshot",
      spaceInstanceId: "space-instance-pinned-snapshot",
      externalRequestId: "matrix-pinned-snapshot",
      kind: "message",
      agentId: "pi",
      agentDefinitionId: "agent-definition-pi-v1",
      agentDefinitionVersion: "1.0.0",
      adapterKey: "pi",
      adapterVersion: "0.2.7",
      sessionGeneration: 3,
      policySnapshotHash: `sha256:${"a".repeat(64)}`,
      reservationTransactionId: "ai-chat:reservation-fixed",
      payloadSchemaVersion: "vibechat.agent-turn-input/v1",
      payload: { requestText: "original" },
    });
    const duplicate = await control.enqueueTurn({
      turnId: "turn-pinned-snapshot-duplicate",
      spaceInstanceId: "space-instance-pinned-snapshot",
      externalRequestId: "matrix-pinned-snapshot",
      kind: "message",
      agentId: "other-agent",
      agentDefinitionId: "other-definition",
      agentDefinitionVersion: "9.9.9",
      adapterKey: "other",
      adapterVersion: "9.9.9",
      sessionGeneration: 99,
      policySnapshotHash: `sha256:${"b".repeat(64)}`,
      reservationTransactionId: "other-reservation",
      payloadSchemaVersion: "other-schema/v9",
      payload: { requestText: "duplicate" },
    });

    expect(duplicate.turnId).toBe(original.turnId);
    expect(await control.getTurn(original.turnId)).toMatchObject({
      agentId: "pi",
      agentDefinitionId: "agent-definition-pi-v1",
      agentDefinitionVersion: "1.0.0",
      adapterKey: "pi",
      adapterVersion: "0.2.7",
      sessionGeneration: 3,
      policySnapshotHash: `sha256:${"a".repeat(64)}`,
      reservationTransactionId: "ai-chat:reservation-fixed",
      payloadSchemaVersion: "vibechat.agent-turn-input/v1",
      payload: { requestText: "original" },
    });
  });

  it("preserves M1/P/M2 ordering, fences the old owner, and deduplicates takeover effects", async () => {
    const instanceId = "space-instance-failover";
    const leaseA = await control.claimLease(instanceId, "replica-a", 5_000);
    expect(leaseA).not.toBeNull();
    await expect(control.claimLease(instanceId, "replica-b", 5_000)).resolves.toBeNull();

    await control.saveProject({
      projectId: "project-failover",
      spaceInstanceId: instanceId,
      sourceObjectKey: "space-runtime/objects/source-m1",
      sourceHash: "sha256:source-m1",
      artifactObjectKey: null,
      artifactHash: null,
      readyRevisionId: "1111111111111111",
      publishedRevisionId: null,
      releaseId: null,
      metadata: {},
    }, leaseA!);

    for (const [turnId, kind, externalRequestId] of [
      ["turn-m1", "message", "matrix-m1"],
      ["turn-p", "publish", "kernel-p"],
      ["turn-m2", "message", "matrix-m2"],
    ] as const) {
      await control.enqueueTurn({
        turnId,
        spaceInstanceId: instanceId,
        externalRequestId,
        kind,
        payload: kind === "publish" ? { expectedReadyRevisionId: "1111111111111111" } : {},
      });
      now = new Date(now.getTime() + 1);
    }

    const m1 = await control.claimNextTurn(instanceId, leaseA!);
    expect(m1?.turnId).toBe("turn-m1");
    await control.completeTurn("turn-m1", leaseA!, "completed");
    const publishBeforeCrash = await control.claimNextTurn(instanceId, leaseA!);
    expect(publishBeforeCrash).toMatchObject({ turnId: "turn-p", attempt: 1 });

    now = new Date(now.getTime() + 6_000);
    const leaseB = await control.claimLease(instanceId, "replica-b", 5_000);
    expect(leaseB?.fencingToken).toBe(2);
    await expect(control.assertLease(leaseA!)).rejects.toMatchObject({
      code: "SPACE_RUNTIME_FENCED",
    });
    const recoveredPublish = await control.claimNextTurn(instanceId, leaseB!);
    expect(recoveredPublish).toMatchObject({ turnId: "turn-p", attempt: 2 });
    expect(await control.getTurn("turn-p")).toMatchObject({
      status: "active",
      ownerId: "replica-b",
      fencingToken: 2,
    });
    await expect(control.saveInstance({
      spaceInstanceId: instanceId,
      sequence: 99,
      snapshot: {},
    }, leaseA!)).rejects.toMatchObject({ code: "SPACE_RUNTIME_FENCED" });

    const published = await control.publishProject({
      spaceInstanceId: instanceId,
      expectedReadyRevisionId: "1111111111111111",
      publishedRevisionId: "1111111111111111",
      releaseId: "release-m1",
      artifactObjectKey: "space-runtime/objects/artifact-m1",
      artifactHash: "sha256:artifact-m1",
    }, leaseB!);
    expect(published?.publishedRevisionId).toBe("1111111111111111");
    await control.completeTurn("turn-p", leaseB!, "completed");
    expect(await control.getTurn("turn-p")).toMatchObject({ status: "completed" });

    await control.saveProject({
      ...published!,
      readyRevisionId: "2222222222222222",
      sourceObjectKey: "space-runtime/objects/source-m2",
      sourceHash: "sha256:source-m2",
      metadata: {},
    }, leaseB!);
    const m2 = await control.claimNextTurn(instanceId, leaseB!);
    expect(m2?.turnId).toBe("turn-m2");
    expect((await control.loadProject(instanceId))).toMatchObject({
      readyRevisionId: "2222222222222222",
      publishedRevisionId: "1111111111111111",
      releaseId: "release-m1",
    });
    await control.completeTurn("turn-m2", leaseB!, "completed");
    await expect(control.releaseLease(leaseB!)).resolves.toBe(true);
    const leaseC = await control.claimLease(instanceId, "replica-c", 5_000);
    expect(leaseC?.fencingToken).toBe(3);

    const reply = await control.enqueueOutbox({
      eventId: "outbox-reply-1",
      spaceInstanceId: instanceId,
      eventType: "agent_reply",
      dedupeKey: "turn-m2",
      payload: { transactionId: "space-agent-turn-m2" },
    });
    const duplicate = await control.enqueueOutbox({
      eventId: "outbox-reply-duplicate",
      spaceInstanceId: instanceId,
      eventType: "agent_reply",
      dedupeKey: "turn-m2",
      payload: { transactionId: "space-agent-turn-m2" },
    });
    expect(duplicate.eventId).toBe(reply.eventId);

    const firstDelivery = await control.claimOutbox("reconciler-a");
    expect(firstDelivery).toHaveLength(1);
    const exactlyOnceSink = new Set<string>();
    exactlyOnceSink.add(firstDelivery[0]!.dedupeKey);
    now = new Date(now.getTime() + 61_000);
    const retriedDelivery = await control.claimOutbox("reconciler-b");
    expect(retriedDelivery[0]).toMatchObject({ eventId: reply.eventId, attempt: 2 });
    exactlyOnceSink.add(retriedDelivery[0]!.dedupeKey);
    await control.completeOutbox(reply.eventId, "reconciler-b");
    expect(exactlyOnceSink.size).toBe(1);
  });

  it("persists cancellation once and keeps terminal Turns immutable", async () => {
    const instanceId = "space-instance-cancellation";
    const firstRequestedAt = new Date(now);
    firstRequestedAt.setMilliseconds(0);
    await control.enqueueTurn({
      turnId: "turn-cancelled",
      spaceInstanceId: instanceId,
      externalRequestId: "matrix-cancelled",
      kind: "message",
      payload: { clientId: "member-1" },
    });

    await expect(
      control.requestTurnCancellation("turn-cancelled", firstRequestedAt),
    ).resolves.toEqual(firstRequestedAt);
    await expect(
      control.requestTurnCancellation(
        "turn-cancelled",
        new Date(firstRequestedAt.getTime() + 1_000),
      ),
    ).resolves.toEqual(firstRequestedAt);

    const lease = await control.claimLease(instanceId, "runtime-cancel", 5_000);
    expect(await control.claimNextTurn(instanceId, lease!)).toMatchObject({
      turnId: "turn-cancelled",
      cancelRequestedAt: firstRequestedAt,
    });
    await control.completeTurn("turn-cancelled", lease!, "failed");
    await expect(
      control.requestTurnCancellation(
        "turn-cancelled",
        new Date(firstRequestedAt.getTime() + 2_000),
      ),
    ).resolves.toEqual(firstRequestedAt);

    await control.enqueueTurn({
      turnId: "turn-completed-without-cancel",
      spaceInstanceId: instanceId,
      externalRequestId: "matrix-completed-without-cancel",
      kind: "message",
      payload: { clientId: "member-1" },
    });
    expect(await control.claimNextTurn(instanceId, lease!)).toMatchObject({
      turnId: "turn-completed-without-cancel",
    });
    await control.completeTurn(
      "turn-completed-without-cancel",
      lease!,
      "completed",
    );
    await expect(
      control.requestTurnCancellation(
        "turn-completed-without-cancel",
        firstRequestedAt,
      ),
    ).resolves.toBeNull();
  });

  it("lets a second SpaceInstanceServer take over an interrupted turn without duplicate completion", async () => {
    const { SpaceInstanceServer } = await import(
      "../../../apps/space-runtime/src/space-instance-server"
    );
    const instanceId = "space-instance-server-failover";
    const replicaA = durableAdapter("runtime-a");
    const replicaB = durableAdapter("runtime-b");
    const serverA = new SpaceInstanceServer(replicaA);
    const serverB = new SpaceInstanceServer(replicaB);

    const m1 = await serverA.beginTurn(instanceId, requestInput("matrix-m1", "message", "M1"));
    now = new Date(now.getTime() + 1);
    const publish = await serverB.beginTurn(
      instanceId,
      requestInput("kernel-p", "publish", "P"),
    );
    now = new Date(now.getTime() + 1);
    const m2 = await serverA.beginTurn(instanceId, requestInput("matrix-m2", "message", "M2"));

    await expect(serverA.claimTurn(instanceId)).resolves.toMatchObject({ turnId: m1.turnId });
    await serverA.completeChat(instanceId, m1.turnId, "M1 done");
    await expect(serverA.claimTurn(instanceId)).resolves.toMatchObject({ turnId: publish.turnId });

    now = new Date(now.getTime() + 6_000);
    await expect(serverB.claimTurn(instanceId)).resolves.toMatchObject({ turnId: publish.turnId });
    await serverB.completeChat(instanceId, publish.turnId, "P done");
    await expect(
      serverA.completeChat(instanceId, publish.turnId, "stale P done"),
    ).rejects.toThrow(/lease|fenced/i);

    await expect(serverB.claimTurn(instanceId)).resolves.toMatchObject({ turnId: m2.turnId });
    await serverB.completeChat(instanceId, m2.turnId, "M2 done");
    const snapshot = await serverB.snapshot(instanceId);
    expect(snapshot.messages.filter(
      (message) => message.turnId === publish.turnId && message.type === "agent",
    )).toHaveLength(1);
    expect(snapshot.messages.filter((message) => message.type === "agent")).toHaveLength(3);
  });
});

function requestInput(
  externalRequestId: string,
  kind: "message" | "publish",
  text: string,
) {
  return {
    clientId: kind === "publish" ? "kernel" : "member-1",
    authorName: kind === "publish" ? "Kernel" : "Member One",
    text,
    kind,
    externalRequestId,
    agentId: kind === "publish" ? "kernel" : "pi",
    ...(kind === "publish"
      ? { publication: { expectedReadyRevisionId: "1111111111111111" } }
      : {}),
  } as const;
}

function durableAdapter(
  ownerId: string,
): import("../../../apps/space-runtime/src/durable-space-control").DurableSpaceControl {
  let lease: import("@libs/space-runtime-control").RuntimeLease | null = null;
  const ensureLease = async (spaceInstanceId: string) => {
    if (lease && lease.expiresAt > now) return lease;
    if (lease) {
      lease = await control.renewLease(lease, 5_000);
      if (lease) return lease;
    }
    lease = await control.claimLease(spaceInstanceId, ownerId, 5_000);
    if (!lease) throw new Error(`lease held for ${spaceInstanceId}`);
    return lease;
  };
  return {
    description: "test-product-db",
    async loadInstance(spaceInstanceId: string) {
      const stored = await control.loadInstance(spaceInstanceId);
      return stored ? { sequence: stored.sequence, snapshot: stored.snapshot } : null;
    },
    async saveInstance(
      spaceInstanceId: string,
      sequence: number,
      snapshot: Record<string, unknown>,
    ) {
      await control.saveInstance(
        { spaceInstanceId, sequence, snapshot },
        await ensureLease(spaceInstanceId),
      );
    },
    async enqueueTurn(
      spaceInstanceId: string,
      request: import("../../../apps/space-runtime/src/space-instance-server").SpaceTurnRequest,
    ) {
      const turn = await control.enqueueTurn({
        turnId: request.turnId,
        spaceInstanceId,
        externalRequestId: request.externalRequestId,
        kind: request.kind,
        payload: request as unknown as Record<string, unknown>,
      });
      return { turnId: turn.turnId, deduplicated: turn.turnId !== request.turnId };
    },
    async claimTurn(spaceInstanceId: string) {
      lease = await control.claimLease(spaceInstanceId, ownerId, 5_000);
      if (!lease) return null;
      const turn = await control.claimNextTurn(spaceInstanceId, lease);
      return turn?.payload as unknown as
        import("../../../apps/space-runtime/src/space-instance-server").SpaceTurnRequest | null;
    },
    async completeTurn(
      spaceInstanceId: string,
      turnId: string,
      status: "completed" | "failed",
    ) {
      return control.completeTurn(turnId, await ensureLease(spaceInstanceId), status);
    },
    async loadAgentSession() {
      return null;
    },
    async saveAgentSession() {
      throw new Error("Agent sessions are not used by this failover fixture");
    },
    async rebuildAgentSession() {
      throw new Error("Agent sessions are not used by this failover fixture");
    },
    async recordAgentAudit() {
      throw new Error("Agent audits are not used by this failover fixture");
    },
    async getAgentTurnControl(spaceInstanceId: string, turnId: string) {
      const turn = await control.getTurn(turnId);
      if (!turn || turn.spaceInstanceId !== spaceInstanceId) {
        throw new Error(`turn not found for ${spaceInstanceId}`);
      }
      return {
        status: turn.status,
        cancelRequestedAt: turn.cancelRequestedAt?.toISOString() || null,
      };
    },
    async heartbeat(spaceInstanceId: string) {
      await ensureLease(spaceInstanceId);
    },
    listRunnableSpaceInstanceIds() {
      return control.listRunnableSpaceInstanceIds();
    },
    async reconcileOutbox() {},
  };
}
