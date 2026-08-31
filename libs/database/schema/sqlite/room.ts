import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const roomIndex = sqliteTable("room_index", {
  matrixRoomId: text("matrix_room_id").primaryKey(),
  spaceInstanceId: text("space_instance_id"),
  projectId: text("project_id"),
  defaultAgentId: text("default_agent_id").notNull().default("pi"),
  clientRequestId: text("client_request_id").notNull(),
  spaceId: text("space_id"),
  spaceVersionId: text("space_version_id"),
  creatorUserId: text("creator_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  participantUserIdsJson: text("participant_user_ids_json", { mode: "json" }).$type<string[]>().notNull().default([]),
  instanceConfigJson: text("instance_config_json", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("room_index_space_instance_idx").on(table.spaceInstanceId),
  uniqueIndex("room_index_creator_request_idx").on(table.creatorUserId, table.clientRequestId),
  index("room_index_creator_idx").on(table.creatorUserId),
]);

export type RoomIndex = InferSelectModel<typeof roomIndex>;
export type NewRoomIndex = InferInsertModel<typeof roomIndex>;
