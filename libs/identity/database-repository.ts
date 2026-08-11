import { eq } from "drizzle-orm";
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
    await db.insert(matrixSessionBinding).values(binding).onConflictDoNothing();
    const stored = await this.getSessionBinding(binding.authSessionId);
    if (!stored) throw new Error("Matrix session binding could not be persisted");
    return stored;
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

  private async getProfile(userId: string) {
    const [stored] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);

    return (stored as ProductProfile | undefined) || null;
  }
}
