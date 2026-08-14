import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { boolean, index, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './user';

export const aiGenerationTask = pgTable('ai_generation_task', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  providerTaskId: text('provider_task_id'),
  consumeTransactionId: text('consume_transaction_id').notNull(),
  creditCost: numeric('credit_cost').notNull(),
  status: text('status').notNull(),
  result: jsonb('result'),
  errorMessage: text('error_message'),
  refunded: boolean('refunded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('ai_generation_task_user_idx').on(table.userId, table.createdAt),
  index('ai_generation_task_provider_idx').on(table.provider, table.providerTaskId),
]);

export type AiGenerationTask = InferSelectModel<typeof aiGenerationTask>;
export type NewAiGenerationTask = InferInsertModel<typeof aiGenerationTask>;
