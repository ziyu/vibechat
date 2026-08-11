import { existsSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IdentityRepository } from "@libs/identity/contracts";
import type { MatrixSessionBindingRecord, ProductProfile } from "@libs/identity/types";

const databasePath = `/tmp/vibechat-identity-${process.pid}-${Date.now()}.sqlite`;
let repository: IdentityRepository;
let database: typeof import("@libs/database");

beforeAll(async () => {
  process.env.DB_DIALECT = "sqlite";
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();

  database = await import("@libs/database");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { DatabaseIdentityRepository } = await import("@libs/identity/database-repository");

  migrate(database.db as never, {
    migrationsFolder: "libs/database/drizzle-sqlite",
  });
  await database.db.insert(database.user).values({
    id: "user-repository-test",
    name: "Repository Test",
    email: "repository@example.com",
    emailVerified: true,
  });
  repository = new DatabaseIdentityRepository();
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

describe("DatabaseIdentityRepository on SQLite", () => {
  it("keeps the first product profile as the product display authority", async () => {
    const createdAt = new Date("2026-08-11T08:00:00.000Z");
    const profile: ProductProfile = {
      userId: "user-repository-test",
      username: "repository_test",
      displayName: "Original display name",
      avatarUrl: null,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    };

    const first = await repository.ensureProfile(profile);
    const repeated = await repository.ensureProfile({
      ...profile,
      displayName: "Auth changed this",
      avatarUrl: "https://example.com/changed.png",
    });

    expect(repeated).toEqual(first);
    expect(repeated.displayName).toBe("Original display name");
    expect(repeated.avatarUrl).toBeNull();
  });

  it("persists one encrypted session binding and one idempotent revoke event", async () => {
    const now = new Date("2026-08-11T08:00:00.000Z");
    await repository.ensureMatrixIdentity({
      userId: "user-repository-test",
      matrixUserId: "@repository_test:example.com",
      status: "active",
      provisionedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const binding: MatrixSessionBindingRecord = {
      authSessionId: "auth-session-1",
      userId: "user-repository-test",
      matrixUserId: "@repository_test:example.com",
      matrixDeviceId: "DEVICE_1",
      matrixAccessTokenCiphertext: "v1.iv.ciphertext",
      createdAt: now,
      revokedAt: null,
    };

    const firstResult = await repository.ensureSessionBinding(binding);
    const repeatedResult = await repository.ensureSessionBinding({
      ...binding,
      matrixDeviceId: "DEVICE_SHOULD_NOT_REPLACE",
      matrixAccessTokenCiphertext: "plaintext-should-not-win",
    });
    expect(firstResult.created).toBe(true);
    expect(repeatedResult.created).toBe(false);
    expect(repeatedResult.binding).toEqual(firstResult.binding);
    expect(repeatedResult.binding.matrixAccessTokenCiphertext).toBe("v1.iv.ciphertext");

    const event = {
      id: "outbox-event-1",
      eventType: "matrix.device.revoke" as const,
      aggregateId: "auth-session-1",
      payload: {
        matrixUserId: binding.matrixUserId,
        matrixDeviceId: binding.matrixDeviceId,
      },
      attempts: 0,
      availableAt: now,
      processedAt: null,
    };
    await repository.revokeSessionBinding("auth-session-1", now, event);
    await repository.revokeSessionBinding("auth-session-1", now, {
      ...event,
      id: "outbox-event-2",
    });

    const storedBinding = await repository.getSessionBinding("auth-session-1");
    const outboxRows = await database.db.select().from(database.integrationOutbox);
    expect(storedBinding?.revokedAt).toEqual(now);
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]).toMatchObject({
      eventType: "matrix.device.revoke",
      aggregateId: "auth-session-1",
      payloadJson: event.payload,
    });
  });
});
