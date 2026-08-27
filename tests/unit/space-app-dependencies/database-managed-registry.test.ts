import { existsSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/vibechat-managed-registry-${process.pid}-${Date.now()}.sqlite`;
let database: typeof import("@libs/database");
let store: import("@libs/space-app-registry").DatabaseManagedPackageReleaseStore;
let conflictError: typeof import("@libs/space-app-registry").ManagedPackageReleaseConflictError;

beforeAll(async () => {
  process.env.DB_DIALECT = "sqlite";
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();

  database = await import("@libs/database");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const registry = await import("@libs/space-app-registry");
  migrate(database.db as never, { migrationsFolder: "libs/database/drizzle-sqlite" });
  store = new registry.DatabaseManagedPackageReleaseStore();
  conflictError = registry.ManagedPackageReleaseConflictError;
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

function release(objectHash: `sha256:${string}`) {
  return {
    releaseId: "managed-package:@vibechat/space-app-components@0.8.1",
    name: "@vibechat/space-app-components",
    version: "0.8.1",
    integrity: "sha256:6d980005ca07a1a9ac76dad9c18524bb3e1885261616252f949d9787af996dc2" as const,
    packageFormat: "vibechat-managed-package-v1" as const,
    projectFormats: ["agentos-app-v1"] as const,
    objectKey: `space-runtime/objects/${objectHash.slice(7)}`,
    objectHash,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
  };
}

describe("Database managed package Registry on SQLite", () => {
  it("keeps name/version immutable and duplicate publication idempotent", async () => {
    const expected = release(
      "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    );
    const first = await store.publish(expected);
    const duplicate = await store.publish(expected);

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    await expect(store.find(expected.name, expected.version)).resolves.toEqual(
      first.release,
    );
    await expect(store.publish(release(
      "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    ))).rejects.toBeInstanceOf(conflictError);
  });
});
