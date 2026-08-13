import { existsSync, rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const databasePath = `/tmp/vibechat-payment-fulfillment-${process.pid}-${Date.now()}.sqlite`;
let database: typeof import('@libs/database');
let fulfillPaidOrder: typeof import('@libs/payment').fulfillPaidOrder;

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.AFFILIATE_ENABLED = 'false';
  vi.resetModules();
  database = await import('@libs/database');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' });
  ({ fulfillPaidOrder } = await import('@libs/payment'));

  const now = new Date('2026-08-13T00:00:00.000Z');
  await database.db.insert(database.user).values([
    {
      id: 'credit-buyer',
      name: 'Credit Buyer',
      email: 'credit-buyer@example.com',
      emailVerified: true,
      creditBalance: '0',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'subscription-buyer',
      name: 'Subscription Buyer',
      email: 'subscription-buyer@example.com',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await database.db.insert(database.order).values([
    {
      id: 'credit-order',
      userId: 'credit-buyer',
      amount: '5',
      currency: 'USD',
      planId: 'credits100',
      status: 'pending',
      provider: 'stripe',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'subscription-order',
      userId: 'subscription-buyer',
      amount: '10',
      currency: 'USD',
      planId: 'monthlyPaypalOneTime',
      status: 'pending',
      provider: 'paypal',
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

afterAll(() => {
  database.sqliteInstance?.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  delete process.env.AFFILIATE_ENABLED;
  delete process.env.SQLITE_DB_PATH;
  delete process.env.DB_DIALECT;
});

describe('Paid order fulfillment on SQLite', () => {
  it('grants a credit pack exactly once across duplicate provider callbacks', async () => {
    const first = await fulfillPaidOrder({
      orderId: 'credit-order',
      providerOrderId: 'cs_test_credit',
      providerEventId: 'evt_credit_1',
      paidAmount: 5,
      paidCurrency: 'USD',
      providerProductId: 'price_1SiVbxDjHLfDWeHDQ4BNtUNT',
    });
    const repeated = await fulfillPaidOrder({
      orderId: 'credit-order',
      providerOrderId: 'cs_test_credit',
      providerEventId: 'evt_credit_1',
      paidAmount: 5,
      paidCurrency: 'USD',
      providerProductId: 'price_1SiVbxDjHLfDWeHDQ4BNtUNT',
    });

    expect(first).toMatchObject({ kind: 'credits', idempotent: false });
    expect(repeated).toMatchObject({ kind: 'credits', idempotent: true });
    const [buyer] = await database.db.select().from(database.user)
      .where((await import('drizzle-orm')).eq(database.user.id, 'credit-buyer'));
    const transactions = await database.db.select().from(database.creditTransaction)
      .where((await import('drizzle-orm')).eq(database.creditTransaction.orderId, 'credit-order'));
    expect(Number(buyer.creditBalance)).toBe(100);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ id: 'purchase:credit-order', amount: '100' });
    expect(Number(transactions[0].balance)).toBe(100);
  });

  it('creates one deterministic entitlement across duplicate callbacks', async () => {
    const first = await fulfillPaidOrder({
      orderId: 'subscription-order',
      providerOrderId: 'PAYPAL-ORDER-1',
      providerEventId: 'PAYPAL-CAPTURE-1',
      paidAmount: 10,
      paidCurrency: 'USD',
    });
    const repeated = await fulfillPaidOrder({
      orderId: 'subscription-order',
      providerOrderId: 'PAYPAL-ORDER-1',
      providerEventId: 'PAYPAL-CAPTURE-1',
      paidAmount: 10,
      paidCurrency: 'USD',
    });

    expect(first).toMatchObject({ kind: 'subscription', idempotent: false });
    expect(repeated).toMatchObject({ kind: 'subscription', idempotent: true });
    const entitlements = await database.db.select().from(database.subscription)
      .where((await import('drizzle-orm')).eq(database.subscription.userId, 'subscription-buyer'));
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]).toMatchObject({
      id: 'entitlement:subscription-order',
      planId: 'monthlyPaypalOneTime',
      status: 'active',
    });
  });

  it('rejects a provider amount mismatch without granting credits', async () => {
    const now = new Date('2026-08-13T00:00:00.000Z');
    await database.db.insert(database.order).values({
      id: 'mismatched-order',
      userId: 'credit-buyer',
      amount: '5',
      currency: 'USD',
      planId: 'credits100',
      status: 'pending',
      provider: 'stripe',
      createdAt: now,
      updatedAt: now,
    });

    await expect(fulfillPaidOrder({
      orderId: 'mismatched-order',
      paidAmount: 0.5,
      paidCurrency: 'USD',
      providerProductId: 'price_1SiVbxDjHLfDWeHDQ4BNtUNT',
    })).rejects.toThrow('amount mismatch');
    const transactions = await database.db.select().from(database.creditTransaction)
      .where((await import('drizzle-orm')).eq(database.creditTransaction.orderId, 'mismatched-order'));
    expect(transactions).toHaveLength(0);
  });

  it.each([
    ['reported user', { reportedUserId: 'subscription-buyer', providerProductId: 'price_1SiVbxDjHLfDWeHDQ4BNtUNT' }, 'user mismatch'],
    ['reported plan', { reportedPlanId: 'monthly', providerProductId: 'price_1SiVbxDjHLfDWeHDQ4BNtUNT' }, 'reported plan mismatch'],
    ['missing provider product', {}, 'provider product mismatch'],
    ['provider product', { providerProductId: 'price_wrong' }, 'provider product mismatch'],
  ])('rejects a %s mismatch before granting credits', async (_label, mismatch, expectedMessage) => {
    const orderId = `mismatched-${String(_label).replace(' ', '-')}`;
    const now = new Date('2026-08-13T00:00:00.000Z');
    await database.db.insert(database.order).values({
      id: orderId,
      userId: 'credit-buyer',
      amount: '5',
      currency: 'USD',
      planId: 'credits100',
      status: 'pending',
      provider: 'stripe',
      createdAt: now,
      updatedAt: now,
    });

    await expect(fulfillPaidOrder({
      orderId,
      paidAmount: 5,
      paidCurrency: 'USD',
      ...mismatch,
    })).rejects.toThrow(expectedMessage);
    const [storedOrder] = await database.db.select().from(database.order)
      .where((await import('drizzle-orm')).eq(database.order.id, orderId));
    const transactions = await database.db.select().from(database.creditTransaction)
      .where((await import('drizzle-orm')).eq(database.creditTransaction.orderId, orderId));
    expect(storedOrder.status).toBe('pending');
    expect(transactions).toHaveLength(0);
  });
});
