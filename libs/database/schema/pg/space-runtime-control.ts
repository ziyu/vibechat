import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const spaceRuntimeInstanceState = pgTable("space_runtime_instance_state", {
  spaceInstanceId: text("space_instance_id").primaryKey(),
  sequence: integer("sequence").notNull().default(0),
  snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>().notNull().default({}),
  fencingToken: integer("fencing_token").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const spaceRuntimeProject = pgTable("space_runtime_project", {
  projectId: text("project_id").primaryKey(),
  spaceInstanceId: text("space_instance_id").notNull(),
  sourceObjectKey: text("source_object_key"),
  sourceHash: text("source_hash"),
  artifactObjectKey: text("artifact_object_key"),
  artifactHash: text("artifact_hash"),
  readyRevisionId: text("ready_revision_id"),
  publishedRevisionId: text("published_revision_id"),
  releaseId: text("release_id"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  fencingToken: integer("fencing_token").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("space_runtime_project_instance_idx").on(table.spaceInstanceId),
]);

export const spaceRuntimeProjectRevision = pgTable("space_runtime_project_revision", {
  spaceInstanceId: text("space_instance_id").notNull(),
  projectId: text("project_id").notNull(),
  revisionId: text("revision_id").notNull(),
  parentRevisionId: text("parent_revision_id"),
  sourceObjectKey: text("source_object_key").notNull(),
  sourceHash: text("source_hash").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  fencingToken: integer("fencing_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({
    name: "space_runtime_project_revision_pk",
    columns: [table.spaceInstanceId, table.revisionId],
  }),
  index("space_runtime_project_revision_history_idx").on(
    table.spaceInstanceId,
    table.createdAt,
  ),
]);

export const spaceRuntimeTurn = pgTable("space_runtime_turn", {
  turnId: text("turn_id").primaryKey(),
  spaceInstanceId: text("space_instance_id").notNull(),
  externalRequestId: text("external_request_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("queued"),
  agentId: text('agent_id'),
  agentDefinitionId: text('agent_definition_id'),
  agentDefinitionVersion: text('agent_definition_version'),
  adapterKey: text('adapter_key'),
  adapterVersion: text('adapter_version'),
  sessionGeneration: integer('session_generation'),
  policySnapshotHash: text('policy_snapshot_hash'),
  reservationTransactionId: text('reservation_transaction_id'),
  payloadSchemaVersion: text('payload_schema_version'),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  resultSchemaVersion: text('result_schema_version'),
  resultJson: jsonb('result_json').$type<Record<string, unknown>>(),
  cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),
  attempt: integer("attempt").notNull().default(0),
  ownerId: text("owner_id"),
  fencingToken: integer("fencing_token").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("space_runtime_turn_request_idx").on(table.spaceInstanceId, table.externalRequestId),
  index("space_runtime_turn_queue_idx").on(table.spaceInstanceId, table.status, table.createdAt),
]);

export const spaceRuntimeLease = pgTable("space_runtime_lease", {
  spaceInstanceId: text("space_instance_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  fencingToken: integer("fencing_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("space_runtime_lease_expiry_idx").on(table.expiresAt),
]);

export const spaceRuntimeOutbox = pgTable("space_runtime_outbox", {
  eventId: text("event_id").primaryKey(),
  spaceInstanceId: text("space_instance_id").notNull(),
  eventType: text("event_type").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  attempt: integer("attempt").notNull().default(0),
  ownerId: text("owner_id"),
  fencingToken: integer("fencing_token").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("space_runtime_outbox_dedupe_idx").on(table.eventType, table.dedupeKey),
  index("space_runtime_outbox_pending_idx").on(table.status, table.availableAt),
]);

export type SpaceRuntimeInstanceStateRow = InferSelectModel<typeof spaceRuntimeInstanceState>;
export type NewSpaceRuntimeInstanceStateRow = InferInsertModel<typeof spaceRuntimeInstanceState>;
export type SpaceRuntimeProjectRow = InferSelectModel<typeof spaceRuntimeProject>;
export type NewSpaceRuntimeProjectRow = InferInsertModel<typeof spaceRuntimeProject>;
export type SpaceRuntimeProjectRevisionRow = InferSelectModel<typeof spaceRuntimeProjectRevision>;
export type NewSpaceRuntimeProjectRevisionRow = InferInsertModel<typeof spaceRuntimeProjectRevision>;
export type SpaceRuntimeTurnRow = InferSelectModel<typeof spaceRuntimeTurn>;
export type NewSpaceRuntimeTurnRow = InferInsertModel<typeof spaceRuntimeTurn>;
export type SpaceRuntimeLeaseRow = InferSelectModel<typeof spaceRuntimeLease>;
export type NewSpaceRuntimeLeaseRow = InferInsertModel<typeof spaceRuntimeLease>;
export type SpaceRuntimeOutboxRow = InferSelectModel<typeof spaceRuntimeOutbox>;
export type NewSpaceRuntimeOutboxRow = InferInsertModel<typeof spaceRuntimeOutbox>;
