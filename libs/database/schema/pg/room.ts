import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./user";

export const roomIndex = pgTable("room_index", {
  matrixRoomId: text("matrix_room_id").primaryKey(),
  spaceInstanceId: text("space_instance_id"),
  projectId: text("project_id"),
  defaultAgentId: text("default_agent_id").notNull().default("pi"),
  clientRequestId: text("client_request_id").notNull(),
  spaceId: text("space_id"),
  spaceVersionId: text("space_version_id"),
  creatorUserId: text("creator_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  participantUserIdsJson: jsonb("participant_user_ids_json").$type<string[]>().notNull().default([]),
  instanceConfigJson: jsonb("instance_config_json").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("room_index_space_instance_idx").on(table.spaceInstanceId),
  uniqueIndex("room_index_creator_request_idx").on(table.creatorUserId, table.clientRequestId),
  index("room_index_creator_idx").on(table.creatorUserId),
]);

export type RoomIndex = InferSelectModel<typeof roomIndex>;
export type NewRoomIndex = InferInsertModel<typeof roomIndex>;
