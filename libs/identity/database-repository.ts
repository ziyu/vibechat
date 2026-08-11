import { and, asc, eq, isNull, lte } from "drizzle-orm";
import {
  db,
  integrationOutbox,
  matrixIdentity,
  matrixSessionBinding,
  userProfile,
} from "@libs/database";
import type { IdentityRepository } from "./contracts";
import type {
  IntegrationOutboxRecord,
  MatrixIdentityRecord,
  MatrixSessionBindingRecord,
  ProductProfile,
} from "./types";

export class DatabaseIdentityRepository implements IdentityRepository {
  async ensureProfile(profile: ProductProfile) {
    await db.insert(userProfile).values(profile).onConflictDoNothing();
    const stored = await this.getProfile(profile.userId);
    if (!stored) throw new Error("Product profile could not be persisted");
    return stored;
  }

  async getMatrixIdentity(userId: string) {
    const [stored] = await db
      .select()
      .from(matrixIdentity)
      .where(eq(matrixIdentity.userId, userId))
      .limit(1);

    return (stored as MatrixIdentityRecord | undefined) || null;
  }

  async ensureMatrixIdentity(identity: MatrixIdentityRecord) {
    await db.insert(matrixIdentity).values(identity).onConflictDoNothing();
    const stored = await this.getMatrixIdentity(identity.userId);
    if (!stored) throw new Error("Matrix identity could not be persisted");
    return stored;
  }

  async getSessionBinding(authSessionId: string) {
    const [stored] = await db
      .select()
      .from(matrixSessionBinding)
      .where(eq(matrixSessionBinding.authSessionId, authSessionId))
      .limit(1);

    return (stored as MatrixSessionBindingRecord | undefined) || null;
  }

  async ensureSessionBinding(binding: MatrixSessionBindingRecord) {
    const inserted = await db
      .insert(matrixSessionBinding)
      .values(binding)
      .onConflictDoNothing()
      .returning({ authSessionId: matrixSessionBinding.authSessionId });
    const stored = await this.getSessionBinding(binding.authSessionId);
    if (!stored) throw new Error("Matrix session binding could not be persisted");
    return {
      binding: stored,
      created: inserted.length > 0,
    };
  }

  async revokeSessionBinding(
    authSessionId: string,
    revokedAt: Date,
    outboxEvent: IntegrationOutboxRecord,
  ) {
    await db.insert(integrationOutbox).values({
      id: outboxEvent.id,
      eventType: outboxEvent.eventType,
      aggregateId: outboxEvent.aggregateId,
      payloadJson: outboxEvent.payload,
      attempts: outboxEvent.attempts,
      availableAt: outboxEvent.availableAt,
      processedAt: outboxEvent.processedAt,
    }).onConflictDoNothing({
      target: [integrationOutbox.eventType, integrationOutbox.aggregateId],
    });

    await db
      .update(matrixSessionBinding)
      .set({ revokedAt })
      .where(eq(matrixSessionBinding.authSessionId, authSessionId));

    return this.getSessionBinding(authSessionId);
  }

  async listPendingOutboxEvents(availableAt: Date, limit: number) {
    const rows = await db
      .select()
      .from(integrationOutbox)
      .where(and(
        isNull(integrationOutbox.processedAt),
        lte(integrationOutbox.availableAt, availableAt),
      ))
      .orderBy(asc(integrationOutbox.availableAt), asc(integrationOutbox.id))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType as IntegrationOutboxRecord["eventType"],
      aggregateId: row.aggregateId,
      payload: row.payloadJson as IntegrationOutboxRecord["payload"],
      attempts: row.attempts,
      availableAt: row.availableAt,
      processedAt: row.processedAt,
    }));
  }

  async markOutboxEventProcessed(eventId: string, processedAt: Date) {
    await db
      .update(integrationOutbox)
      .set({ processedAt })
      .where(eq(integrationOutbox.id, eventId));
  }

  async rescheduleOutboxEvent(
    eventId: string,
    attempts: number,
    availableAt: Date,
  ) {
    await db
      .update(integrationOutbox)
      .set({ attempts, availableAt })
      .where(eq(integrationOutbox.id, eventId));
  }

  private async getProfile(userId: string) {
    const [stored] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);

    return (stored as ProductProfile | undefined) || null;
  }
}
