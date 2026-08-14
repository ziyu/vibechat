import { existsSync, rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const databasePath = `/tmp/vibechat-affiliate-${process.pid}-${Date.now()}.sqlite`;
let database: typeof import('@libs/database');
let processWithdrawal: typeof import('@libs/affiliate').processWithdrawal;

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite';
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();
  database = await import('@libs/database');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' });
  ({ processWithdrawal } = await import('@libs/affiliate'));
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

describe('Admin withdrawal processing on SQLite', () => {
  it('claims a rejection once and refunds the reserved balance exactly once', async () => {
    const now = new Date('2026-08-12T00:00:00.000Z');
    await database.db.insert(database.user).values({
      id: 'withdrawal-user',
      name: 'Withdrawal User',
      email: 'withdrawal-user@example.com',
      emailVerified: true,
      commissionBalance: '20',
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(database.withdrawal).values({
      id: 'withdrawal-1',
      userId: 'withdrawal-user',
      amount: '15.5',
      currency: 'USD',
      paymentMethod: 'manual',
      paymentAccount: 'test-account',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await expect(processWithdrawal({
      withdrawalId: 'withdrawal-1',
      status: 'rejected',
      processedBy: 'admin-1',
    })).resolves.toEqual({ success: true });
    await expect(processWithdrawal({
      withdrawalId: 'withdrawal-1',
      status: 'rejected',
      processedBy: 'admin-2',
    })).resolves.toEqual({ success: false, error: 'Withdrawal already processed' });

    const [updatedUser] = await database.db.select().from(database.user)
      .where((await import('drizzle-orm')).eq(database.user.id, 'withdrawal-user'));
    const [updatedWithdrawal] = await database.db.select().from(database.withdrawal)
      .where((await import('drizzle-orm')).eq(database.withdrawal.id, 'withdrawal-1'));
    expect(Number(updatedUser.commissionBalance)).toBe(35.5);
    expect(updatedWithdrawal).toMatchObject({ status: 'rejected', processedBy: 'admin-1' });
  });
});
