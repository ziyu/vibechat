import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './user';

export const aiGenerationTask = sqliteTable('ai_generation_task', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  providerTaskId: text('provider_task_id'),
  consumeTransactionId: text('consume_transaction_id').notNull(),
  creditCost: text('credit_cost').notNull(),
  status: text('status').notNull(),
  result: text('result', { mode: 'json' }),
  errorMessage: text('error_message'),
  refunded: integer('refunded', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('ai_generation_task_user_idx').on(table.userId, table.createdAt),
  index('ai_generation_task_provider_idx').on(table.provider, table.providerTaskId),
]);

export type AiGenerationTask = InferSelectModel<typeof aiGenerationTask>;
export type NewAiGenerationTask = InferInsertModel<typeof aiGenerationTask>;
