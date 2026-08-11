import { existsSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/vibechat-rooms-${process.pid}-${Date.now()}.sqlite`;
let repository: import("@libs/rooms").DatabaseRoomRepository;
let database: typeof import("@libs/database");

beforeAll(async () => {
  process.env.DB_DIALECT = "sqlite";
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();

  database = await import("@libs/database");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { DatabaseRoomRepository } = await import("@libs/rooms/database-repository");
  migrate(database.db as never, { migrationsFolder: "libs/database/drizzle-sqlite" });
  await database.db.insert(database.user).values({
    id: "room-creator",
    name: "Room Creator",
    email: "room-creator@example.com",
    emailVerified: true,
  });
  repository = new DatabaseRoomRepository();
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

describe("DatabaseRoomRepository on SQLite", () => {
  it("persists and reads a room by creator-scoped idempotency key", async () => {
    const record = {
      matrixRoomId: "!room-index:localhost",
      clientRequestId: "client-request-1",
      spaceId: "space-campfire",
      spaceVersionId: "builtin-space-campfire-v1",
      creatorUserId: "room-creator",
      instanceConfig: { ambient: "night" },
      status: "active" as const,
      createdAt: new Date("2026-08-11T15:00:00.000Z"),
    };

    await expect(repository.create(record)).resolves.toEqual(record);
    await expect(repository.getByClientRequestId(
      record.creatorUserId,
      record.clientRequestId,
    )).resolves.toEqual(record);
  });
});
