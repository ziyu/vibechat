import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const userProfile = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("user_profiles_username_idx").on(table.username),
]);

export const matrixIdentity = sqliteTable("matrix_identities", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  matrixUserId: text("matrix_user_id").notNull(),
  status: text("status").notNull().default("active"),
  provisionedAt: integer("provisioned_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("matrix_identities_matrix_user_id_idx").on(table.matrixUserId),
]);

export const matrixSessionBinding = sqliteTable("matrix_session_bindings", {
  authSessionId: text("auth_session_id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  matrixUserId: text("matrix_user_id").notNull(),
  matrixDeviceId: text("matrix_device_id").notNull(),
  matrixAccessTokenCiphertext: text("matrix_access_token_ciphertext").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("matrix_session_bindings_device_idx").on(table.matrixUserId, table.matrixDeviceId),
  index("matrix_session_bindings_user_idx").on(table.userId),
]);

export const integrationOutbox = sqliteTable("integration_outbox", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payloadJson: text("payload_json", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: integer("available_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  processedAt: integer("processed_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("integration_outbox_event_aggregate_idx").on(table.eventType, table.aggregateId),
  index("integration_outbox_pending_idx").on(table.processedAt, table.availableAt),
]);

export type UserProfile = InferSelectModel<typeof userProfile>;
export type NewUserProfile = InferInsertModel<typeof userProfile>;
export type MatrixIdentity = InferSelectModel<typeof matrixIdentity>;
export type NewMatrixIdentity = InferInsertModel<typeof matrixIdentity>;
export type MatrixSessionBinding = InferSelectModel<typeof matrixSessionBinding>;
export type NewMatrixSessionBinding = InferInsertModel<typeof matrixSessionBinding>;
export type IntegrationOutboxEvent = InferSelectModel<typeof integrationOutbox>;
export type NewIntegrationOutboxEvent = InferInsertModel<typeof integrationOutbox>;
