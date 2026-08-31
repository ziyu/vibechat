import { existsSync, readFileSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
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
      spaceInstanceId: "space-instance-1",
      projectId: "space-project-1",
      defaultAgentId: "pi",
      clientRequestId: "client-request-1",
      spaceId: "space-campfire",
      spaceVersionId: "builtin-space-campfire-v1",
      creatorUserId: "room-creator",
      participantUserIds: ["room-creator", "room-participant"],
      instanceConfig: { ambient: "night" },
      status: "active" as const,
      createdAt: new Date("2026-08-11T15:00:00.000Z"),
      updatedAt: new Date("2026-08-11T15:00:00.000Z"),
    };

    await expect(repository.create(record)).resolves.toEqual(record);
    await expect(repository.getByClientRequestId(
      record.creatorUserId,
      record.clientRequestId,
    )).resolves.toEqual(record);
    await expect(repository.getAccessibleByMatrixRoomIds(
      "room-participant",
      [record.matrixRoomId],
    )).resolves.toEqual([record]);
    await expect(repository.getAccessibleByMatrixRoomIds(
      "room-outsider",
      [record.matrixRoomId],
    )).resolves.toEqual([]);
  });

  it("persists a blank Space with nullable Template lineage", async () => {
    const record = {
      matrixRoomId: "!blank-room-index:localhost",
      spaceInstanceId: "space-instance-blank",
      projectId: "space-project-blank",
      defaultAgentId: "pi",
      clientRequestId: "client-request-blank",
      spaceId: null,
      spaceVersionId: null,
      creatorUserId: "room-creator",
      participantUserIds: ["room-creator"],
      instanceConfig: {},
      status: "active" as const,
      createdAt: new Date("2026-08-27T15:00:00.000Z"),
      updatedAt: new Date("2026-08-27T15:00:00.000Z"),
    };

    await expect(repository.create(record)).resolves.toEqual(record);
    await expect(repository.getByClientRequestId(
      record.creatorUserId,
      record.clientRequestId,
    )).resolves.toEqual(record);
  });
});

describe("0017 nullable Space Template lineage migration", () => {
  it("preserves historical Template lineage and accepts blank Space lineage", () => {
    const path = `/tmp/vibechat-rooms-0017-${process.pid}-${Date.now()}.sqlite`;
    const sqlite = new Database(path);
    try {
      sqlite.exec(`
        PRAGMA foreign_keys=ON;
        CREATE TABLE user (id text PRIMARY KEY NOT NULL);
        INSERT INTO user (id) VALUES ('room-creator');
        CREATE TABLE room_index (
          matrix_room_id text PRIMARY KEY NOT NULL,
          space_instance_id text,
          project_id text,
          default_agent_id text DEFAULT 'pi' NOT NULL,
          client_request_id text NOT NULL,
          space_id text NOT NULL,
          space_version_id text NOT NULL,
          creator_user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
          participant_user_ids_json text DEFAULT '[]' NOT NULL,
          instance_config_json text NOT NULL,
          status text DEFAULT 'active' NOT NULL,
          created_at integer NOT NULL,
          updated_at integer NOT NULL
        );
        CREATE UNIQUE INDEX room_index_space_instance_idx
          ON room_index (space_instance_id);
        CREATE UNIQUE INDEX room_index_creator_request_idx
          ON room_index (creator_user_id, client_request_id);
        CREATE INDEX room_index_creator_idx ON room_index (creator_user_id);
        INSERT INTO room_index VALUES (
          '!template:localhost', 'space-template', 'project-template', 'pi',
          'request-template', 'space-campfire', 'tplv-space-campfire-0-1-2',
          'room-creator', '["room-creator"]', '{}', 'active', 1, 1
        );
      `);

      const statements = readFileSync(
        "libs/database/drizzle-sqlite/0017_public_wrecker.sql",
        "utf8",
      ).split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);
      for (const statement of statements) sqlite.exec(statement);

      expect(sqlite.prepare(`
        SELECT space_id AS spaceId, space_version_id AS spaceVersionId
        FROM room_index WHERE matrix_room_id = '!template:localhost'
      `).get()).toEqual({
        spaceId: "space-campfire",
        spaceVersionId: "tplv-space-campfire-0-1-2",
      });
      expect(sqlite.prepare("PRAGMA table_info(room_index)").all()
        .filter((column) => ["space_id", "space_version_id"].includes(
          (column as { name: string }).name,
        ))
        .map((column) => ({
          name: (column as { name: string }).name,
          notNull: (column as { notnull: number }).notnull,
        }))).toEqual([
          { name: "space_id", notNull: 0 },
          { name: "space_version_id", notNull: 0 },
        ]);

      expect(() => sqlite.prepare(`
        INSERT INTO room_index (
          matrix_room_id, space_instance_id, project_id, default_agent_id,
          client_request_id, space_id, space_version_id, creator_user_id,
          participant_user_ids_json, instance_config_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
      `).run(
        "!blank:localhost",
        "space-blank",
        "project-blank",
        "pi",
        "request-blank",
        "room-creator",
        '["room-creator"]',
        "{}",
        "active",
        2,
        2,
      )).not.toThrow();
    } finally {
      sqlite.close();
      for (const suffix of ["", "-shm", "-wal"]) {
        const candidate = `${path}${suffix}`;
        if (existsSync(candidate)) rmSync(candidate, { force: true });
      }
    }
  });
});
