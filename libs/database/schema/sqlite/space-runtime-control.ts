import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const spaceRuntimeInstanceState = sqliteTable("space_runtime_instance_state", {
  spaceInstanceId: text("space_instance_id").primaryKey(),
  sequence: integer("sequence").notNull().default(0),
  snapshotJson: text("snapshot_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  fencingToken: integer("fencing_token").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const spaceRuntimeProject = sqliteTable("space_runtime_project", {
  projectId: text("project_id").primaryKey(),
  spaceInstanceId: text("space_instance_id").notNull(),
  sourceObjectKey: text("source_object_key"),
  sourceHash: text("source_hash"),
  artifactObjectKey: text("artifact_object_key"),
  artifactHash: text("artifact_hash"),
  readyRevisionId: text("ready_revision_id"),
  publishedRevisionId: text("published_revision_id"),
  releaseId: text("release_id"),
  metadataJson: text("metadata_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  fencingToken: integer("fencing_token").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("space_runtime_project_instance_idx").on(table.spaceInstanceId),
]);

export const spaceRuntimeTurn = sqliteTable("space_runtime_turn", {
  turnId: text("turn_id").primaryKey(),
  spaceInstanceId: text("space_instance_id").notNull(),
  externalRequestId: text("external_request_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("queued"),
  payloadJson: text("payload_json", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  attempt: integer("attempt").notNull().default(0),
  ownerId: text("owner_id"),
  fencingToken: integer("fencing_token").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("space_runtime_turn_request_idx").on(table.spaceInstanceId, table.externalRequestId),
  index("space_runtime_turn_queue_idx").on(table.spaceInstanceId, table.status, table.createdAt),
]);

export const spaceRuntimeLease = sqliteTable("space_runtime_lease", {
  spaceInstanceId: text("space_instance_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  fencingToken: integer("fencing_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("space_runtime_lease_expiry_idx").on(table.expiresAt),
]);

export const spaceRuntimeOutbox = sqliteTable("space_runtime_outbox", {
  eventId: text("event_id").primaryKey(),
  spaceInstanceId: text("space_instance_id").notNull(),
  eventType: text("event_type").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  payloadJson: text("payload_json", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  attempt: integer("attempt").notNull().default(0),
  ownerId: text("owner_id"),
  fencingToken: integer("fencing_token").notNull().default(0),
  availableAt: integer("available_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("space_runtime_outbox_dedupe_idx").on(table.eventType, table.dedupeKey),
  index("space_runtime_outbox_pending_idx").on(table.status, table.availableAt),
]);

export type SpaceRuntimeInstanceStateRow = InferSelectModel<typeof spaceRuntimeInstanceState>;
export type NewSpaceRuntimeInstanceStateRow = InferInsertModel<typeof spaceRuntimeInstanceState>;
export type SpaceRuntimeProjectRow = InferSelectModel<typeof spaceRuntimeProject>;
export type NewSpaceRuntimeProjectRow = InferInsertModel<typeof spaceRuntimeProject>;
export type SpaceRuntimeTurnRow = InferSelectModel<typeof spaceRuntimeTurn>;
export type NewSpaceRuntimeTurnRow = InferInsertModel<typeof spaceRuntimeTurn>;
export type SpaceRuntimeLeaseRow = InferSelectModel<typeof spaceRuntimeLease>;
export type NewSpaceRuntimeLeaseRow = InferInsertModel<typeof spaceRuntimeLease>;
export type SpaceRuntimeOutboxRow = InferSelectModel<typeof spaceRuntimeOutbox>;
export type NewSpaceRuntimeOutboxRow = InferInsertModel<typeof spaceRuntimeOutbox>;
