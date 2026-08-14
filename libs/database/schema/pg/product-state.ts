import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user";

export const userPreference = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  theme: text("theme").notNull().default("system"),
  locale: text("locale").notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roomUserPreference = pgTable("room_user_preferences", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  matrixRoomId: text("matrix_room_id").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  muted: boolean("muted").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.matrixRoomId] }),
  index("room_user_preferences_user_idx").on(table.userId),
]);

export const spaceFavorite = pgTable("space_favorites", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  spaceId: text("space_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
