import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./user";

export const friendRequest = pgTable("friend_requests", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("friend_requests_sender_recipient_idx").on(table.senderId, table.recipientId),
  index("friend_requests_recipient_status_idx").on(table.recipientId, table.status),
]);

export const contact = pgTable("contacts", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  contactUserId: text("contact_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  remark: text("remark"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.contactUserId] }),
  index("contacts_contact_user_idx").on(table.contactUserId),
]);

export const block = pgTable("blocks", {
  blockerId: text("blocker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  blockedUserId: text("blocked_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
