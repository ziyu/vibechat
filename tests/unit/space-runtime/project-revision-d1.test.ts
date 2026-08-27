import { existsSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/vibechat-project-revision-d1-${process.pid}-${Date.now()}.sqlite`;
let sqlite: Database.Database;
let withD1: NonNullable<typeof import("@libs/database").withD1>;
let control: import("@libs/space-runtime-control").DatabaseSpaceRuntimeControlPlane;

beforeAll(async () => {
  sqlite = new Database(databasePath);
  migrate(drizzle(sqlite), { migrationsFolder: "libs/database/drizzle-sqlite" });
  process.env.DB_DIALECT = "d1";
  vi.resetModules();
  const database = await import("@libs/database");
  const { DatabaseSpaceRuntimeControlPlane } = await import("@libs/space-runtime-control");
  if (!database.withD1) throw new Error("D1 request context is unavailable");
  withD1 = database.withD1;
  control = new DatabaseSpaceRuntimeControlPlane(
    () => new Date("2026-08-28T02:00:00.000Z"),
  );
});

afterAll(() => {
  sqlite?.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  delete process.env.DB_DIALECT;
});

describe("Space Project Revision D1 batch contract", () => {
  it("moves the ready pointer and registers an immutable Revision in one batch", async () => {
    await withD1(new BetterSqliteD1Binding(sqlite), async () => {
      const lease = await control.claimLease("space-d1-revisions", "runtime-d1", 30_000);
      expect(lease).not.toBeNull();
      await control.saveProject(project("1111111111111111", "a"), lease!);
      await control.saveProject(project("2222222222222222", "b"), lease!);
      await control.saveProject({
        ...project("2222222222222222", "b"),
        sourceObjectKey: `space-runtime/objects/${"c".repeat(64)}`,
      }, lease!);

      expect(await control.listProjectRevisions("space-d1-revisions")).toMatchObject([
        {
          revisionId: "2222222222222222",
          parentRevisionId: "1111111111111111",
          sourceObjectKey: `space-runtime/objects/${"b".repeat(64)}`,
        },
        {
          revisionId: "1111111111111111",
          parentRevisionId: null,
        },
      ]);
      expect(await control.loadProject("space-d1-revisions")).toMatchObject({
        readyRevisionId: "2222222222222222",
        sourceObjectKey: `space-runtime/objects/${"c".repeat(64)}`,
      });
    });
  });
});

function project(revisionId: string, objectByte: string) {
  return {
    projectId: "project-d1-revisions",
    spaceInstanceId: "space-d1-revisions",
    sourceObjectKey: `space-runtime/objects/${objectByte.repeat(64)}`,
    sourceHash: `sha256:${objectByte.repeat(64)}`,
    artifactObjectKey: null,
    artifactHash: null,
    readyRevisionId: revisionId,
    publishedRevisionId: null,
    releaseId: null,
    metadata: {},
  };
}

class BetterSqliteD1Binding {
  constructor(private readonly database: Database.Database) {}

  prepare(query: string) {
    return new BetterSqliteD1Statement(this.database, query);
  }

  async batch(statements: BetterSqliteD1Statement[]) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

class BetterSqliteD1Statement {
  private parameters: unknown[] = [];

  constructor(
    private readonly database: Database.Database,
    private readonly query: string,
  ) {}

  bind(...parameters: unknown[]) {
    const statement = new BetterSqliteD1Statement(this.database, this.query);
    statement.parameters = parameters;
    return statement;
  }

  async all() {
    return {
      success: true,
      results: this.database.prepare(this.query).all(...this.parameters),
      meta: {},
    };
  }

  async raw() {
    return this.database.prepare(this.query).raw(true).all(...this.parameters);
  }

  async run() {
    const result = this.database.prepare(this.query).run(...this.parameters);
    return {
      success: true,
      results: [],
      meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) },
    };
  }
}
