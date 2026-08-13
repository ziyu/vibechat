import { existsSync, rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const databasePath = `/tmp/vibechat-chat-billing-${process.pid}-${Date.now()}.sqlite`;
let database: typeof import('@libs/database');
let billing: typeof import('@libs/ai/chat-billing');

const messages = [{
  id: 'message-1',
  role: 'user' as const,
  parts: [{ type: 'text' as const, text: 'Give me a short project update.' }],
}];

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite';
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();
  database = await import('@libs/database');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' });
  await database.db.insert(database.user).values([
    { id: 'settlement-user', name: 'Settlement User', email: 'settlement@example.com', emailVerified: true, creditBalance: '100' },
    { id: 'refund-user', name: 'Refund User', email: 'refund@example.com', emailVerified: true, creditBalance: '100' },
  ]);
  billing = await import('@libs/ai/chat-billing');
});

afterAll(() => {
  database.sqliteInstance?.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  delete process.env.SQLITE_DB_PATH;
  delete process.env.DB_DIALECT;
});

describe('AI chat credit reservation and settlement', () => {
  it('settles to actual usage and refunds the difference exactly once', async () => {
    const context = { userId: 'settlement-user', requestId: 'chat:settlement-1', provider: 'qwen', model: 'qwen-turbo' };
    const reservation = await billing.reserveChatCredits(context, messages);
    expect(reservation.success).toBe(true);
    expect(reservation.reservedCredits).toBeGreaterThan(1);

    const first = await billing.settleChatCredits(context, reservation, {
      inputTokens: 250,
      outputTokens: 250,
      totalTokens: 500,
    });
    const repeated = await billing.settleChatCredits(context, reservation, {
      inputTokens: 250,
      outputTokens: 250,
      totalTokens: 500,
    });
    expect(first.chargedCredits).toBe(1);
    expect(repeated).toEqual(first);

    const [user] = await database.db.select().from(database.user)
      .where((await import('drizzle-orm')).eq(database.user.id, context.userId));
    expect(Number(user.creditBalance)).toBe(99);
    const transactions = await database.db.select().from(database.creditTransaction)
      .where((await import('drizzle-orm')).eq(database.creditTransaction.userId, context.userId));
    expect(transactions.filter((row) => row.id === `ai-chat:${context.requestId}`)).toHaveLength(1);
    expect(transactions.filter((row) => row.id === `settlement-refund:ai-chat:${context.requestId}`)).toHaveLength(1);
  });

  it('refunds a failed stream once and does not deduct again for a duplicate request id', async () => {
    const context = { userId: 'refund-user', requestId: 'chat:failure-1', provider: 'qwen', model: 'qwen-plus' };
    const reservation = await billing.reserveChatCredits(context, messages);
    expect(reservation.success).toBe(true);
    await billing.refundChatCredits(context, reservation, 'stream_failed');
    await billing.refundChatCredits(context, reservation, 'stream_failed');

    const duplicate = await billing.reserveChatCredits(context, messages);
    expect(duplicate).toMatchObject({ success: true, idempotent: true });
    const [user] = await database.db.select().from(database.user)
      .where((await import('drizzle-orm')).eq(database.user.id, context.userId));
    expect(Number(user.creditBalance)).toBe(100);
    const transactions = await database.db.select().from(database.creditTransaction)
      .where((await import('drizzle-orm')).eq(database.creditTransaction.userId, context.userId));
    expect(transactions).toHaveLength(2);
  });
});
