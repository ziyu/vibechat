import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const userPreference = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
  theme: text("theme").notNull().default("system"),
  locale: text("locale").notNull().default("en"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const roomUserPreference = sqliteTable("room_user_preferences", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  matrixRoomId: text("matrix_room_id").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  muted: integer("muted", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.userId, table.matrixRoomId] }),
  index("room_user_preferences_user_idx").on(table.userId),
]);

export const spaceFavorite = sqliteTable("space_favorites", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  spaceId: text("space_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.userId, table.spaceId] }),
  index("space_favorites_space_idx").on(table.spaceId),
]);

export type UserPreference = InferSelectModel<typeof userPreference>;
export type NewUserPreference = InferInsertModel<typeof userPreference>;
export type RoomUserPreference = InferSelectModel<typeof roomUserPreference>;
export type NewRoomUserPreference = InferInsertModel<typeof roomUserPreference>;
export type SpaceFavorite = InferSelectModel<typeof spaceFavorite>;
export type NewSpaceFavorite = InferInsertModel<typeof spaceFavorite>;
