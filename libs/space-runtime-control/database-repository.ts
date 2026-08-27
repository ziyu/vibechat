import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  db,
  isD1Dialect,
  isSqliteDialect,
  runD1Batch,
  spaceRuntimeInstanceState,
  spaceRuntimeLease,
  spaceRuntimeOutbox,
  spaceRuntimeProject,
  spaceRuntimeProjectRevision,
  spaceRuntimeTurn,
} from "@libs/database";
import type {
  RuntimeInstanceState,
  RuntimeLease,
  RuntimeOutboxEvent,
  RuntimeProjectPointer,
  RuntimeProjectRevision,
  RuntimeTurnEnqueue,
  RuntimeTurnRecord,
  SpaceRuntimeControlPlane,
} from "./contracts";
import { RuntimeFencingError } from "./contracts";

export class DatabaseSpaceRuntimeControlPlane implements SpaceRuntimeControlPlane {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async loadInstance(spaceInstanceId: string) {
    const [stored] = await db.select().from(spaceRuntimeInstanceState)
      .where(eq(spaceRuntimeInstanceState.spaceInstanceId, spaceInstanceId)).limit(1);
    return stored ? this.instance(stored) : null;
  }

  async saveInstance(
    state: Omit<RuntimeInstanceState, "fencingToken" | "updatedAt">,
    lease: RuntimeLease,
  ) {
    await this.assertLease(lease);
    const updatedAt = this.now();
    const values = {
      spaceInstanceId: state.spaceInstanceId,
      sequence: state.sequence,
      snapshotJson: state.snapshot,
      fencingToken: lease.fencingToken,
      updatedAt,
    };
    const existing = await this.loadInstance(state.spaceInstanceId);
    if (!existing) {
      await db.insert(spaceRuntimeInstanceState).values(values).onConflictDoNothing();
    } else {
      const updated = await db.update(spaceRuntimeInstanceState).set({
        sequence: state.sequence,
        snapshotJson: state.snapshot,
        updatedAt,
      }).where(and(
        eq(spaceRuntimeInstanceState.spaceInstanceId, state.spaceInstanceId),
        eq(spaceRuntimeInstanceState.fencingToken, lease.fencingToken),
      )).returning({ spaceInstanceId: spaceRuntimeInstanceState.spaceInstanceId });
      if (!updated.length) throw new RuntimeFencingError(state.spaceInstanceId);
    }
    const persisted = await this.loadInstance(state.spaceInstanceId);
    if (!persisted || persisted.fencingToken !== lease.fencingToken) {
      throw new RuntimeFencingError(state.spaceInstanceId);
    }
    return {
      ...state,
      fencingToken: lease.fencingToken,
      updatedAt,
    };
  }

  async loadProject(spaceInstanceId: string) {
    const [stored] = await db.select().from(spaceRuntimeProject)
      .where(eq(spaceRuntimeProject.spaceInstanceId, spaceInstanceId)).limit(1);
    return stored ? this.project(stored) : null;
  }

  async loadProjectRevision(spaceInstanceId: string, revisionId: string) {
    const [stored] = await db.select().from(spaceRuntimeProjectRevision).where(and(
      eq(spaceRuntimeProjectRevision.spaceInstanceId, spaceInstanceId),
      eq(spaceRuntimeProjectRevision.revisionId, revisionId),
    )).limit(1);
    return stored ? this.projectRevision(stored) : null;
  }

  async listProjectRevisions(spaceInstanceId: string, limit = 50) {
    const rows = await db.select().from(spaceRuntimeProjectRevision)
      .where(eq(spaceRuntimeProjectRevision.spaceInstanceId, spaceInstanceId))
      .orderBy(desc(spaceRuntimeProjectRevision.createdAt), desc(spaceRuntimeProjectRevision.revisionId))
      .limit(Math.max(1, Math.min(50, limit)));
    return rows.map((row) => this.projectRevision(row));
  }

  async saveProject(
    project: Omit<RuntimeProjectPointer, "fencingToken" | "updatedAt">,
    lease: RuntimeLease,
  ) {
    await this.assertLease(lease);
    const updatedAt = this.now();
    const values = {
      projectId: project.projectId,
      spaceInstanceId: project.spaceInstanceId,
      sourceObjectKey: project.sourceObjectKey,
      sourceHash: project.sourceHash,
      artifactObjectKey: project.artifactObjectKey,
      artifactHash: project.artifactHash,
      readyRevisionId: project.readyRevisionId,
      publishedRevisionId: project.publishedRevisionId,
      releaseId: project.releaseId,
      metadataJson: project.metadata,
      fencingToken: lease.fencingToken,
      updatedAt,
    };
    const existing = await this.loadProject(project.spaceInstanceId);
    const updateValues = {
        sourceObjectKey: project.sourceObjectKey,
        sourceHash: project.sourceHash,
        artifactObjectKey: project.artifactObjectKey,
        artifactHash: project.artifactHash,
        readyRevisionId: project.readyRevisionId,
        publishedRevisionId: project.publishedRevisionId,
        releaseId: project.releaseId,
        metadataJson: project.metadata,
        updatedAt,
      };
    const updateWhere = and(
        eq(spaceRuntimeProject.projectId, project.projectId),
        eq(spaceRuntimeProject.spaceInstanceId, project.spaceInstanceId),
        eq(spaceRuntimeProject.fencingToken, lease.fencingToken),
      );
    const revisionValues = project.readyRevisionId
      && project.sourceObjectKey
      && project.sourceHash
      ? {
          spaceInstanceId: project.spaceInstanceId,
          projectId: project.projectId,
          revisionId: project.readyRevisionId,
          parentRevisionId: existing?.readyRevisionId !== project.readyRevisionId
            ? existing?.readyRevisionId ?? null
            : null,
          sourceObjectKey: project.sourceObjectKey,
          sourceHash: project.sourceHash,
          metadataJson: project.metadata,
          fencingToken: lease.fencingToken,
          createdAt: updatedAt,
        }
      : null;

    if (isD1Dialect()) {
      const pointerWrite = existing
        ? db.update(spaceRuntimeProject).set(updateValues).where(updateWhere)
        : db.insert(spaceRuntimeProject).values(values).onConflictDoNothing();
      if (revisionValues) {
        const revisionWrite = db.insert(spaceRuntimeProjectRevision).select(
          db.select({
            spaceInstanceId: spaceRuntimeProject.spaceInstanceId,
            projectId: spaceRuntimeProject.projectId,
            revisionId: sql<string>`${revisionValues.revisionId}`,
            parentRevisionId: sql<string | null>`${revisionValues.parentRevisionId}`,
            sourceObjectKey: spaceRuntimeProject.sourceObjectKey,
            sourceHash: spaceRuntimeProject.sourceHash,
            metadataJson: spaceRuntimeProject.metadataJson,
            fencingToken: spaceRuntimeProject.fencingToken,
            createdAt: spaceRuntimeProject.updatedAt,
          }).from(spaceRuntimeProject).where(and(
            eq(spaceRuntimeProject.spaceInstanceId, project.spaceInstanceId),
            eq(spaceRuntimeProject.projectId, project.projectId),
            eq(spaceRuntimeProject.fencingToken, lease.fencingToken),
            eq(spaceRuntimeProject.readyRevisionId, revisionValues.revisionId),
            eq(spaceRuntimeProject.sourceObjectKey, revisionValues.sourceObjectKey),
            eq(spaceRuntimeProject.sourceHash, revisionValues.sourceHash),
          )) as never,
        ).onConflictDoNothing();
        await runD1Batch([pointerWrite, revisionWrite] as const);
      } else {
        await runD1Batch([pointerWrite] as const);
      }
    } else if (isSqliteDialect()) {
      (db as any).transaction((transaction: any) => {
        if (existing) {
          const result = transaction.update(spaceRuntimeProject).set(updateValues)
            .where(updateWhere).run();
          if (result.changes !== 1) throw new RuntimeFencingError(project.spaceInstanceId);
        } else {
          transaction.insert(spaceRuntimeProject).values(values).onConflictDoNothing().run();
        }
        const persisted = transaction.select().from(spaceRuntimeProject)
          .where(eq(spaceRuntimeProject.spaceInstanceId, project.spaceInstanceId))
          .limit(1).get();
        if (!persisted || !matchesProjectWrite(persisted, project, lease)) {
          throw new RuntimeFencingError(project.spaceInstanceId);
        }
        if (revisionValues) {
          transaction.insert(spaceRuntimeProjectRevision).values(revisionValues)
            .onConflictDoNothing().run();
        }
      });
    } else {
      await db.transaction(async (transaction) => {
        if (existing) {
          const updated = await transaction.update(spaceRuntimeProject).set(updateValues)
            .where(updateWhere).returning({ projectId: spaceRuntimeProject.projectId });
          if (updated.length !== 1) throw new RuntimeFencingError(project.spaceInstanceId);
        } else {
          await transaction.insert(spaceRuntimeProject).values(values).onConflictDoNothing();
        }
        const [persisted] = await transaction.select().from(spaceRuntimeProject)
          .where(eq(spaceRuntimeProject.spaceInstanceId, project.spaceInstanceId)).limit(1);
        if (!persisted || !matchesProjectWrite(persisted, project, lease)) {
          throw new RuntimeFencingError(project.spaceInstanceId);
        }
        if (revisionValues) {
          await transaction.insert(spaceRuntimeProjectRevision).values(revisionValues)
            .onConflictDoNothing();
        }
      });
    }
    const persisted = await this.loadProject(project.spaceInstanceId);
    if (!persisted || !matchesProjectWrite(persisted, project, lease)) {
      throw new RuntimeFencingError(project.spaceInstanceId);
    }
    if (revisionValues) {
      const revision = await this.loadProjectRevision(
        project.spaceInstanceId,
        revisionValues.revisionId,
      );
      if (
        !revision
        || revision.projectId !== project.projectId
        || revision.sourceHash !== revisionValues.sourceHash
      ) {
        throw new Error(`Space Project Revision ${revisionValues.revisionId} is inconsistent`);
      }
    }
    return { ...project, fencingToken: lease.fencingToken, updatedAt };
  }

  async publishProject(input: {
    spaceInstanceId: string;
    expectedReadyRevisionId: string;
    publishedRevisionId: string;
    releaseId: string;
    artifactObjectKey: string;
    artifactHash: string;
  }, lease: RuntimeLease) {
    await this.assertLease(lease);
    const updated = await db.update(spaceRuntimeProject).set({
      publishedRevisionId: input.publishedRevisionId,
      releaseId: input.releaseId,
      artifactObjectKey: input.artifactObjectKey,
      artifactHash: input.artifactHash,
      fencingToken: lease.fencingToken,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeProject.spaceInstanceId, input.spaceInstanceId),
      eq(spaceRuntimeProject.readyRevisionId, input.expectedReadyRevisionId),
      eq(spaceRuntimeProject.fencingToken, lease.fencingToken),
    )).returning();
    return updated[0] ? this.project(updated[0]) : null;
  }

  async enqueueTurn(
    turn: RuntimeTurnEnqueue,
  ) {
    const createdAt = this.now();
    await db.insert(spaceRuntimeTurn).values({
      turnId: turn.turnId,
      spaceInstanceId: turn.spaceInstanceId,
      externalRequestId: turn.externalRequestId,
      kind: turn.kind,
      status: "queued",
      agentId: turn.agentId ?? null,
      agentDefinitionId: turn.agentDefinitionId ?? null,
      agentDefinitionVersion: turn.agentDefinitionVersion ?? null,
      adapterKey: turn.adapterKey ?? null,
      adapterVersion: turn.adapterVersion ?? null,
      sessionGeneration: turn.sessionGeneration ?? null,
      policySnapshotHash: turn.policySnapshotHash ?? null,
      reservationTransactionId: turn.reservationTransactionId ?? null,
      payloadSchemaVersion: turn.payloadSchemaVersion ?? null,
      payloadJson: turn.payload,
      resultSchemaVersion: turn.resultSchemaVersion ?? null,
      resultJson: turn.result ?? null,
      cancelRequestedAt: turn.cancelRequestedAt ?? null,
      attempt: 0,
      fencingToken: 0,
      createdAt,
      updatedAt: createdAt,
    }).onConflictDoNothing();
    const [stored] = await db.select().from(spaceRuntimeTurn).where(and(
      eq(spaceRuntimeTurn.spaceInstanceId, turn.spaceInstanceId),
      eq(spaceRuntimeTurn.externalRequestId, turn.externalRequestId),
    )).limit(1);
    if (!stored) throw new Error("Runtime turn could not be enqueued");
    return this.turn(stored);
  }

  async getTurn(turnId: string) {
    const [stored] = await db.select().from(spaceRuntimeTurn)
      .where(eq(spaceRuntimeTurn.turnId, turnId)).limit(1);
    return stored ? this.turn(stored) : null;
  }

  async requestTurnCancellation(turnId: string, requestedAt: Date) {
    const updated = await db.update(spaceRuntimeTurn).set({
      cancelRequestedAt: requestedAt,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeTurn.turnId, turnId),
      inArray(spaceRuntimeTurn.status, ["queued", "active"]),
      isNull(spaceRuntimeTurn.cancelRequestedAt),
    )).returning({ cancelRequestedAt: spaceRuntimeTurn.cancelRequestedAt });
    if (updated[0]?.cancelRequestedAt) return updated[0].cancelRequestedAt;
    return (await this.getTurn(turnId))?.cancelRequestedAt ?? null;
  }

  async claimNextTurn(spaceInstanceId: string, lease: RuntimeLease) {
    await this.assertLease(lease);
    await this.recoverInterruptedTurns(spaceInstanceId, lease);
    const [queued] = await db.select().from(spaceRuntimeTurn).where(and(
      eq(spaceRuntimeTurn.spaceInstanceId, spaceInstanceId),
      eq(spaceRuntimeTurn.status, "queued"),
    )).orderBy(asc(spaceRuntimeTurn.createdAt)).limit(1);
    if (!queued) return null;
    const updatedAt = this.now();
    const claimed = await db.update(spaceRuntimeTurn).set({
      status: "active",
      ownerId: lease.ownerId,
      fencingToken: lease.fencingToken,
      attempt: queued.attempt + 1,
      updatedAt,
    }).where(and(
      eq(spaceRuntimeTurn.turnId, queued.turnId),
      eq(spaceRuntimeTurn.status, "queued"),
    )).returning();
    return claimed[0] ? this.turn(claimed[0]) : null;
  }

  async completeTurn(
    turnId: string,
    lease: RuntimeLease,
    status: "completed" | "failed",
  ) {
    await this.assertLease(lease);
    const updated = await db.update(spaceRuntimeTurn).set({
      status,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeTurn.turnId, turnId),
      eq(spaceRuntimeTurn.status, "active"),
      eq(spaceRuntimeTurn.ownerId, lease.ownerId),
      eq(spaceRuntimeTurn.fencingToken, lease.fencingToken),
    )).returning({ turnId: spaceRuntimeTurn.turnId });
    return updated.length === 1;
  }

  async recoverInterruptedTurns(spaceInstanceId: string, lease: RuntimeLease) {
    await this.assertLease(lease);
    const recovered = await db.update(spaceRuntimeTurn).set({
      status: "queued",
      ownerId: null,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeTurn.spaceInstanceId, spaceInstanceId),
      eq(spaceRuntimeTurn.status, "active"),
      lte(spaceRuntimeTurn.fencingToken, lease.fencingToken - 1),
    )).returning({ turnId: spaceRuntimeTurn.turnId });
    return recovered.length;
  }

  async listRunnableSpaceInstanceIds(limit = 100) {
    const rows = await db.selectDistinct({
      spaceInstanceId: spaceRuntimeTurn.spaceInstanceId,
    }).from(spaceRuntimeTurn).where(
      inArray(spaceRuntimeTurn.status, ["queued", "active"]),
    ).orderBy(asc(spaceRuntimeTurn.spaceInstanceId))
      .limit(Math.max(1, Math.min(100, limit)));
    return rows.map((row) => row.spaceInstanceId);
  }

  async claimLease(spaceInstanceId: string, ownerId: string, ttlMs: number) {
    this.assertTtl(ttlMs);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const now = this.now();
      const expiresAt = new Date(now.getTime() + ttlMs);
      const [current] = await db.select().from(spaceRuntimeLease)
        .where(eq(spaceRuntimeLease.spaceInstanceId, spaceInstanceId)).limit(1);
      if (!current) {
        await db.insert(spaceRuntimeLease).values({
          spaceInstanceId,
          ownerId,
          fencingToken: 1,
          expiresAt,
          updatedAt: now,
        }).onConflictDoNothing();
      } else if (current.ownerId === ownerId && current.expiresAt > now) {
        const renewed = await db.update(spaceRuntimeLease).set({ expiresAt, updatedAt: now })
          .where(and(
            eq(spaceRuntimeLease.spaceInstanceId, spaceInstanceId),
            eq(spaceRuntimeLease.ownerId, ownerId),
            eq(spaceRuntimeLease.fencingToken, current.fencingToken),
          )).returning();
        if (renewed[0]) return this.lease(renewed[0]);
      } else if (current.expiresAt <= now) {
        const taken = await db.update(spaceRuntimeLease).set({
          ownerId,
          fencingToken: current.fencingToken + 1,
          expiresAt,
          updatedAt: now,
        }).where(and(
          eq(spaceRuntimeLease.spaceInstanceId, spaceInstanceId),
          eq(spaceRuntimeLease.fencingToken, current.fencingToken),
          lte(spaceRuntimeLease.expiresAt, now),
        )).returning();
        if (taken[0]) {
          await this.advanceOwnedStateFence(spaceInstanceId, taken[0].fencingToken);
          return this.lease(taken[0]);
        }
      } else {
        return null;
      }

      const [stored] = await db.select().from(spaceRuntimeLease)
        .where(eq(spaceRuntimeLease.spaceInstanceId, spaceInstanceId)).limit(1);
      if (stored?.ownerId === ownerId) return this.lease(stored);
    }
    return null;
  }

  async renewLease(lease: RuntimeLease, ttlMs: number) {
    this.assertTtl(ttlMs);
    const now = this.now();
    const renewed = await db.update(spaceRuntimeLease).set({
      expiresAt: new Date(now.getTime() + ttlMs),
      updatedAt: now,
    }).where(and(
      eq(spaceRuntimeLease.spaceInstanceId, lease.spaceInstanceId),
      eq(spaceRuntimeLease.ownerId, lease.ownerId),
      eq(spaceRuntimeLease.fencingToken, lease.fencingToken),
      gt(spaceRuntimeLease.expiresAt, now),
    )).returning();
    return renewed[0] ? this.lease(renewed[0]) : null;
  }

  async releaseLease(lease: RuntimeLease) {
    const releasedAt = this.now();
    const released = await db.update(spaceRuntimeLease).set({
      expiresAt: releasedAt,
      updatedAt: releasedAt,
    }).where(and(
      eq(spaceRuntimeLease.spaceInstanceId, lease.spaceInstanceId),
      eq(spaceRuntimeLease.ownerId, lease.ownerId),
      eq(spaceRuntimeLease.fencingToken, lease.fencingToken),
    )).returning({ spaceInstanceId: spaceRuntimeLease.spaceInstanceId });
    return released.length === 1;
  }

  async enqueueOutbox(
    event: Pick<RuntimeOutboxEvent, "eventId" | "spaceInstanceId" | "eventType" | "dedupeKey" | "payload">,
  ) {
    const createdAt = this.now();
    await db.insert(spaceRuntimeOutbox).values({
      eventId: event.eventId,
      spaceInstanceId: event.spaceInstanceId,
      eventType: event.eventType,
      dedupeKey: event.dedupeKey,
      payloadJson: event.payload,
      status: "pending",
      attempt: 0,
      fencingToken: 0,
      availableAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    }).onConflictDoNothing();
    const [stored] = await db.select().from(spaceRuntimeOutbox).where(and(
      eq(spaceRuntimeOutbox.eventType, event.eventType),
      eq(spaceRuntimeOutbox.dedupeKey, event.dedupeKey),
    )).limit(1);
    if (!stored) throw new Error("Runtime outbox event could not be enqueued");
    return this.outbox(stored);
  }

  async claimOutbox(ownerId: string, limit = 20) {
    const now = this.now();
    const candidates = await db.select().from(spaceRuntimeOutbox).where(and(
      inArray(spaceRuntimeOutbox.status, ["pending", "processing"]),
      lte(spaceRuntimeOutbox.availableAt, now),
      or(
        eq(spaceRuntimeOutbox.status, "pending"),
        lte(spaceRuntimeOutbox.updatedAt, new Date(now.getTime() - 60_000)),
      ),
    )).orderBy(asc(spaceRuntimeOutbox.createdAt)).limit(Math.max(1, Math.min(100, limit)));
    const claimed: RuntimeOutboxEvent[] = [];
    for (const event of candidates) {
      const [updated] = await db.update(spaceRuntimeOutbox).set({
        status: "processing",
        ownerId,
        attempt: event.attempt + 1,
        updatedAt: now,
      }).where(and(
        eq(spaceRuntimeOutbox.eventId, event.eventId),
        eq(spaceRuntimeOutbox.status, event.status),
        eq(spaceRuntimeOutbox.updatedAt, event.updatedAt),
      )).returning();
      if (updated) claimed.push(this.outbox(updated));
    }
    return claimed;
  }

  async completeOutbox(eventId: string, ownerId: string) {
    const updated = await db.update(spaceRuntimeOutbox).set({
      status: "completed",
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeOutbox.eventId, eventId),
      eq(spaceRuntimeOutbox.status, "processing"),
      eq(spaceRuntimeOutbox.ownerId, ownerId),
    )).returning({ eventId: spaceRuntimeOutbox.eventId });
    return updated.length === 1;
  }

  async retryOutbox(eventId: string, ownerId: string, availableAt: Date) {
    const updated = await db.update(spaceRuntimeOutbox).set({
      status: "pending",
      ownerId: null,
      availableAt,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeOutbox.eventId, eventId),
      eq(spaceRuntimeOutbox.status, "processing"),
      eq(spaceRuntimeOutbox.ownerId, ownerId),
    )).returning({ eventId: spaceRuntimeOutbox.eventId });
    return updated.length === 1;
  }

  async assertLease(lease: RuntimeLease) {
    const [stored] = await db.select().from(spaceRuntimeLease).where(and(
      eq(spaceRuntimeLease.spaceInstanceId, lease.spaceInstanceId),
      eq(spaceRuntimeLease.ownerId, lease.ownerId),
      eq(spaceRuntimeLease.fencingToken, lease.fencingToken),
      gt(spaceRuntimeLease.expiresAt, this.now()),
    )).limit(1);
    if (!stored) throw new RuntimeFencingError(lease.spaceInstanceId);
  }

  private async advanceOwnedStateFence(spaceInstanceId: string, fencingToken: number) {
    await db.update(spaceRuntimeInstanceState).set({
      fencingToken,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeInstanceState.spaceInstanceId, spaceInstanceId),
      lt(spaceRuntimeInstanceState.fencingToken, fencingToken),
    ));
    await db.update(spaceRuntimeProject).set({
      fencingToken,
      updatedAt: this.now(),
    }).where(and(
      eq(spaceRuntimeProject.spaceInstanceId, spaceInstanceId),
      lt(spaceRuntimeProject.fencingToken, fencingToken),
    ));
  }

  private assertTtl(ttlMs: number) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 5 * 60_000) {
      throw new RangeError("Runtime lease ttl must be between 1s and 5m");
    }
  }

  private lease(row: typeof spaceRuntimeLease.$inferSelect): RuntimeLease {
    return {
      spaceInstanceId: row.spaceInstanceId,
      ownerId: row.ownerId,
      fencingToken: row.fencingToken,
      expiresAt: row.expiresAt,
    };
  }

  private instance(row: typeof spaceRuntimeInstanceState.$inferSelect): RuntimeInstanceState {
    return {
      spaceInstanceId: row.spaceInstanceId,
      sequence: row.sequence,
      snapshot: row.snapshotJson,
      fencingToken: row.fencingToken,
      updatedAt: row.updatedAt,
    };
  }

  private project(row: typeof spaceRuntimeProject.$inferSelect): RuntimeProjectPointer {
    return {
      projectId: row.projectId,
      spaceInstanceId: row.spaceInstanceId,
      sourceObjectKey: row.sourceObjectKey,
      sourceHash: row.sourceHash,
      artifactObjectKey: row.artifactObjectKey,
      artifactHash: row.artifactHash,
      readyRevisionId: row.readyRevisionId,
      publishedRevisionId: row.publishedRevisionId,
      releaseId: row.releaseId,
      metadata: row.metadataJson,
      fencingToken: row.fencingToken,
      updatedAt: row.updatedAt,
    };
  }

  private projectRevision(
    row: typeof spaceRuntimeProjectRevision.$inferSelect,
  ): RuntimeProjectRevision {
    return {
      spaceInstanceId: row.spaceInstanceId,
      projectId: row.projectId,
      revisionId: row.revisionId,
      parentRevisionId: row.parentRevisionId,
      sourceObjectKey: row.sourceObjectKey,
      sourceHash: row.sourceHash,
      metadata: row.metadataJson,
      fencingToken: row.fencingToken,
      createdAt: row.createdAt,
    };
  }

  private turn(row: typeof spaceRuntimeTurn.$inferSelect): RuntimeTurnRecord {
    return {
      turnId: row.turnId,
      spaceInstanceId: row.spaceInstanceId,
      externalRequestId: row.externalRequestId,
      kind: row.kind as RuntimeTurnRecord["kind"],
      status: row.status as RuntimeTurnRecord["status"],
      agentId: row.agentId,
      agentDefinitionId: row.agentDefinitionId,
      agentDefinitionVersion: row.agentDefinitionVersion,
      adapterKey: row.adapterKey,
      adapterVersion: row.adapterVersion,
      sessionGeneration: row.sessionGeneration,
      policySnapshotHash: row.policySnapshotHash,
      reservationTransactionId: row.reservationTransactionId,
      payloadSchemaVersion: row.payloadSchemaVersion,
      payload: row.payloadJson,
      resultSchemaVersion: row.resultSchemaVersion,
      result: row.resultJson,
      cancelRequestedAt: row.cancelRequestedAt,
      attempt: row.attempt,
      ownerId: row.ownerId,
      fencingToken: row.fencingToken,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private outbox(row: typeof spaceRuntimeOutbox.$inferSelect): RuntimeOutboxEvent {
    return {
      eventId: row.eventId,
      spaceInstanceId: row.spaceInstanceId,
      eventType: row.eventType as RuntimeOutboxEvent["eventType"],
      dedupeKey: row.dedupeKey,
      payload: row.payloadJson,
      status: row.status as RuntimeOutboxEvent["status"],
      attempt: row.attempt,
      ownerId: row.ownerId,
      fencingToken: row.fencingToken,
      availableAt: row.availableAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function matchesProjectWrite(
  persisted: Pick<
    RuntimeProjectPointer,
    | "projectId"
    | "spaceInstanceId"
    | "sourceObjectKey"
    | "sourceHash"
    | "readyRevisionId"
    | "publishedRevisionId"
    | "releaseId"
    | "fencingToken"
  >,
  expected: Omit<RuntimeProjectPointer, "fencingToken" | "updatedAt">,
  lease: RuntimeLease,
) {
  return persisted.projectId === expected.projectId
    && persisted.spaceInstanceId === expected.spaceInstanceId
    && persisted.sourceObjectKey === expected.sourceObjectKey
    && persisted.sourceHash === expected.sourceHash
    && persisted.readyRevisionId === expected.readyRevisionId
    && persisted.publishedRevisionId === expected.publishedRevisionId
    && persisted.releaseId === expected.releaseId
    && persisted.fencingToken === lease.fencingToken;
}
