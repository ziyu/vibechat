import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./user";

export const userProfile = pgTable("user_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_profiles_username_idx").on(table.username),
]);

export const matrixIdentity = pgTable("matrix_identities", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  matrixUserId: text("matrix_user_id").notNull(),
  status: text("status").notNull().default("active"),
  provisionedAt: timestamp("provisioned_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("matrix_identities_matrix_user_id_idx").on(table.matrixUserId),
]);

export const matrixSessionBinding = pgTable("matrix_session_bindings", {
  authSessionId: text("auth_session_id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  matrixUserId: text("matrix_user_id").notNull(),
  matrixDeviceId: text("matrix_device_id").notNull(),
  matrixAccessTokenCiphertext: text("matrix_access_token_ciphertext").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("matrix_session_bindings_device_idx").on(table.matrixUserId, table.matrixDeviceId),
  index("matrix_session_bindings_user_idx").on(table.userId),
]);

export const integrationOutbox = pgTable("integration_outbox", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
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
