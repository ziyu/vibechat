import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const friendRequest = sqliteTable("friend_requests", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("friend_requests_sender_recipient_idx").on(table.senderId, table.recipientId),
  index("friend_requests_recipient_status_idx").on(table.recipientId, table.status),
]);

export const contact = sqliteTable("contacts", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  contactUserId: text("contact_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  remark: text("remark"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.userId, table.contactUserId] }),
  index("contacts_contact_user_idx").on(table.contactUserId),
]);

export const block = sqliteTable("blocks", {
  blockerId: text("blocker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  blockedUserId: text("blocked_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.blockerId, table.blockedUserId] }),
  index("blocks_blocked_user_idx").on(table.blockedUserId),
]);

export type FriendRequest = InferSelectModel<typeof friendRequest>;
export type NewFriendRequest = InferInsertModel<typeof friendRequest>;
export type Contact = InferSelectModel<typeof contact>;
export type NewContact = InferInsertModel<typeof contact>;
export type Block = InferSelectModel<typeof block>;
export type NewBlock = InferInsertModel<typeof block>;
