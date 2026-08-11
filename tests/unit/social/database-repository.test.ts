import { existsSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/vibechat-social-${process.pid}-${Date.now()}.sqlite`;
let repository: import("@libs/social").DatabaseSocialRepository;
let database: typeof import("@libs/database");

beforeAll(async () => {
  process.env.DB_DIALECT = "sqlite";
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();
  database = await import("@libs/database");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { DatabaseSocialRepository } = await import("@libs/social/database-repository");
  migrate(database.db as never, { migrationsFolder: "libs/database/drizzle-sqlite" });
  const now = new Date("2026-08-12T00:00:00.000Z");
  for (const id of ["social-alice", "social-bob"]) {
    await database.db.insert(database.user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
    });
    await database.db.insert(database.userProfile).values({
      userId: id,
      username: id.replace('-', '_'),
      displayName: id,
      avatarUrl: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(database.matrixIdentity).values({
      userId: id,
      matrixUserId: `@vibe_${id.replace('-', '_')}:localhost`,
      status: "active",
      provisionedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  repository = new DatabaseSocialRepository();
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

describe("DatabaseSocialRepository on SQLite", () => {
  it("searches exact email and atomically creates symmetric contacts", async () => {
    await expect(repository.searchProfiles(
      "social-alice",
      "social-bob@example.com",
      20,
    )).resolves.toMatchObject([{ id: "social-bob", matrixUserId: expect.any(String) }]);
    const now = new Date("2026-08-12T00:00:00.000Z");
    const request = await repository.upsertFriendRequest({
      id: "social-request-1",
      senderId: "social-alice",
      recipientId: "social-bob",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await repository.acceptFriendRequest(request, now);

    expect(await repository.isContact("social-alice", "social-bob")).toBe(true);
    expect(await repository.isContact("social-bob", "social-alice")).toBe(true);
    await expect(repository.getSnapshot("social-alice")).resolves.toMatchObject({
      contacts: [{ id: "social-bob" }],
      outgoing: [{ request: { status: "accepted" } }],
    });
  });

  it("blocking removes both contact rows and hides the blocked profile from search", async () => {
    const now = new Date("2026-08-12T00:01:00.000Z");
    await repository.blockUser("social-bob", "social-alice", now);

    expect(await repository.isContact("social-alice", "social-bob")).toBe(false);
    expect(await repository.isContact("social-bob", "social-alice")).toBe(false);
    expect(await repository.hasBlockBetween("social-alice", "social-bob")).toBe(true);
    await expect(repository.searchProfiles(
      "social-alice",
      "social_bob",
      20,
    )).resolves.toEqual([]);
  });
});
