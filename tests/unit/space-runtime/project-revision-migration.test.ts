import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("0018 Space Project Revision migration", () => {
  it("backfills the current ready baseline and scopes equal Revision IDs by Space", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE space_runtime_project (
          project_id text PRIMARY KEY NOT NULL,
          space_instance_id text NOT NULL,
          source_object_key text,
          source_hash text,
          artifact_object_key text,
          artifact_hash text,
          ready_revision_id text,
          published_revision_id text,
          release_id text,
          metadata_json text DEFAULT '{}' NOT NULL,
          fencing_token integer DEFAULT 0 NOT NULL,
          updated_at integer NOT NULL
        );
        INSERT INTO space_runtime_project VALUES (
          'project-a', 'space-a', 'space-runtime/objects/${"a".repeat(64)}',
          'sha256:${"b".repeat(64)}', NULL, NULL, '0123456789abcdef',
          NULL, NULL, '{"template":{"id":"space-default","versionId":"v1"}}',
          3, 1787846400000
        );
      `);
      const statements = readFileSync(
        "libs/database/drizzle-sqlite/0018_fair_white_queen.sql",
        "utf8",
      ).split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
      for (const statement of statements) sqlite.exec(statement);

      expect(sqlite.prepare(`
        SELECT space_instance_id AS spaceInstanceId,
          project_id AS projectId,
          revision_id AS revisionId,
          parent_revision_id AS parentRevisionId,
          source_object_key AS sourceObjectKey,
          source_hash AS sourceHash,
          metadata_json AS metadataJson,
          fencing_token AS fencingToken,
          created_at AS createdAt
        FROM space_runtime_project_revision
      `).get()).toEqual({
        spaceInstanceId: "space-a",
        projectId: "project-a",
        revisionId: "0123456789abcdef",
        parentRevisionId: null,
        sourceObjectKey: `space-runtime/objects/${"a".repeat(64)}`,
        sourceHash: `sha256:${"b".repeat(64)}`,
        metadataJson: '{"template":{"id":"space-default","versionId":"v1"}}',
        fencingToken: 3,
        createdAt: 1787846400000,
      });

      expect(() => sqlite.prepare(`
        INSERT INTO space_runtime_project_revision VALUES (?, ?, ?, NULL, ?, ?, '{}', 1, ?)
      `).run(
        "space-b",
        "project-b",
        "0123456789abcdef",
        `space-runtime/objects/${"c".repeat(64)}`,
        `sha256:${"d".repeat(64)}`,
        1787846400001,
      )).not.toThrow();
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM space_runtime_project_revision").get())
        .toEqual({ count: 2 });
    } finally {
      sqlite.close();
    }
  });
});
