import { db, isD1Dialect, isSqliteDialect, runNativeD1Batch } from '@libs/database';
import { creditTransaction, creditTransactionTypes, user } from '@libs/database/schema';
import { and, asc, count, desc, eq, like, sql } from 'drizzle-orm';
import type { CreditTransaction } from '@libs/database/schema/credit-transaction';
import type {
  AddCreditsParams,
  ConsumeCreditsParams,
  ConsumeCreditsResult,
  GetAllTransactionsOptions,
  GetTransactionsOptions,
  GetTransactionsPaginatedResult,
} from './types';

function parseBalance(value: unknown): number {
  const balance = Number(value);
  return Number.isFinite(balance) ? balance : 0;
}

/** Atomic credit balance mutations plus the user-facing ledger queries. */
export class CreditService {
  async getBalance(userId: string): Promise<number> {
    const [record] = await db
      .select({ creditBalance: user.creditBalance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return parseBalance(record?.creditBalance);
  }

  private async getTransaction(transactionId: string): Promise<CreditTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(creditTransaction)
      .where(eq(creditTransaction.id, transactionId))
      .limit(1);
    return transaction;
  }

  async addCredits(params: AddCreditsParams): Promise<CreditTransaction> {
    const { userId, amount, type, orderId, description, metadata } = params;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Amount must be positive when adding credits');
    }

    const transactionId = params.transactionId || `txn_${crypto.randomUUID()}`;
    const existing = await this.getTransaction(transactionId);
    if (existing) {
      if (existing.userId !== userId || parseBalance(existing.amount) !== amount) {
        throw new Error(`Credit transaction id collision: ${transactionId}`);
      }
      return existing;
    }

    const now = new Date();
    try {
      if (isD1Dialect()) {
        const epoch = Math.floor(now.getTime() / 1000);
        const [, inserted] = await runNativeD1Batch([
          {
            sql: `UPDATE user
                  SET credit_balance = CAST(credit_balance AS REAL) + ?, updated_at = ?
                  WHERE id = ?
                  RETURNING id`,
            params: [amount, epoch, userId],
          },
          {
            sql: `INSERT INTO credit_transaction
                    (id, user_id, type, amount, balance, order_id, description, metadata, created_at)
                  SELECT ?, id, ?, ?, credit_balance, ?, ?, ?, ?
                  FROM user WHERE id = ? AND changes() > 0
                  RETURNING *`,
            params: [transactionId, type, String(amount), orderId || null,
              description || `${type} credits`, metadata ? JSON.stringify(metadata) : null,
              epoch, userId],
          },
        ]);
        const transaction = (inserted?.results ?? [])[0] as CreditTransaction | undefined;
        if (!transaction) throw new Error(`User not found: ${userId}`);
        return transaction;
      }

      if (isSqliteDialect()) {
        let transaction: CreditTransaction | undefined;
        (db as any).transaction((tx: any) => {
          const [updated] = tx.update(user)
            .set({
              creditBalance: sql`CAST(${user.creditBalance} AS REAL) + ${amount}`,
              updatedAt: now,
            })
            .where(eq(user.id, userId))
            .returning({ creditBalance: user.creditBalance })
            .all();
          if (!updated) throw new Error(`User not found: ${userId}`);
          [transaction] = tx.insert(creditTransaction).values({
            id: transactionId,
            userId,
            type,
            amount: String(amount),
            balance: String(updated.creditBalance),
            orderId: orderId || null,
            description: description || `${type} credits`,
            metadata: metadata || null,
            createdAt: now,
          }).returning().all();
        });
        if (!transaction) throw new Error('Credit transaction was not created');
        return transaction;
      }

      return await db.transaction(async (tx) => {
        const [updated] = await tx.update(user)
          .set({
            creditBalance: sql`${user.creditBalance} + ${amount}`,
            updatedAt: now,
          })
          .where(eq(user.id, userId))
          .returning({ creditBalance: user.creditBalance });
        if (!updated) throw new Error(`User not found: ${userId}`);
        const [transaction] = await tx.insert(creditTransaction).values({
          id: transactionId,
          userId,
          type,
          amount: String(amount),
          balance: String(updated.creditBalance),
          orderId: orderId || null,
          description: description || `${type} credits`,
          metadata: metadata || null,
          createdAt: now,
        }).returning();
        return transaction;
      });
    } catch (error) {
      // A concurrent retry may have won the unique-key race. The losing
      // transaction is rolled back, so returning the existing row is safe.
      const idempotent = await this.getTransaction(transactionId);
      if (idempotent && idempotent.userId === userId && parseBalance(idempotent.amount) === amount) {
        return idempotent;
      }
      throw error;
    }
  }

  async consumeCredits(params: ConsumeCreditsParams): Promise<ConsumeCreditsResult> {
    const { userId, amount, description, metadata } = params;
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, newBalance: await this.getBalance(userId), error: 'Amount must be positive when consuming credits' };
    }

    const transactionId = params.transactionId || `txn_${crypto.randomUUID()}`;
    const existing = await this.getTransaction(transactionId);
    if (existing) {
      if (existing.userId !== userId || parseBalance(existing.amount) !== -amount) {
        return { success: false, newBalance: await this.getBalance(userId), error: `Credit transaction id collision: ${transactionId}` };
      }
      return { success: true, newBalance: parseBalance(existing.balance), transactionId, idempotent: true };
    }

    const now = new Date();
    try {
      if (isD1Dialect()) {
        const epoch = Math.floor(now.getTime() / 1000);
        const [updated] = await runNativeD1Batch([
          {
            sql: `UPDATE user
                  SET credit_balance = CAST(credit_balance AS REAL) - ?, updated_at = ?
                  WHERE id = ? AND CAST(credit_balance AS REAL) >= ?
                  RETURNING credit_balance`,
            params: [amount, epoch, userId, amount],
          },
          {
            sql: `INSERT INTO credit_transaction
                    (id, user_id, type, amount, balance, description, metadata, created_at)
                  SELECT ?, id, ?, ?, credit_balance, ?, ?, ?
                  FROM user WHERE id = ? AND changes() > 0`,
            params: [transactionId, creditTransactionTypes.CONSUMPTION, String(-amount),
              description || 'Credits consumed', metadata ? JSON.stringify(metadata) : null,
              epoch, userId],
          },
        ]);
        const row = (updated?.results ?? [])[0] as { credit_balance: string } | undefined;
        if (!row) {
          return { success: false, newBalance: await this.getBalance(userId), error: 'Insufficient credits' };
        }
        return { success: true, newBalance: parseBalance(row.credit_balance), transactionId };
      }

      if (isSqliteDialect()) {
        let newBalance: number | undefined;
        (db as any).transaction((tx: any) => {
          const [updated] = tx.update(user)
            .set({
              creditBalance: sql`CAST(${user.creditBalance} AS REAL) - ${amount}`,
              updatedAt: now,
            })
            .where(and(
              eq(user.id, userId),
              sql`CAST(${user.creditBalance} AS REAL) >= ${amount}`,
            ))
            .returning({ creditBalance: user.creditBalance })
            .all();
          if (!updated) return;
          newBalance = parseBalance(updated.creditBalance);
          tx.insert(creditTransaction).values({
            id: transactionId,
            userId,
            type: creditTransactionTypes.CONSUMPTION,
            amount: String(-amount),
            balance: String(newBalance),
            description: description || 'Credits consumed',
            metadata: metadata || null,
            createdAt: now,
          }).run();
        });
        if (newBalance === undefined) {
          return { success: false, newBalance: await this.getBalance(userId), error: 'Insufficient credits' };
        }
        return { success: true, newBalance, transactionId };
      }

      return await db.transaction(async (tx) => {
        const [updated] = await tx.update(user)
          .set({ creditBalance: sql`${user.creditBalance} - ${amount}`, updatedAt: now })
          .where(and(eq(user.id, userId), sql`${user.creditBalance} >= ${amount}`))
          .returning({ creditBalance: user.creditBalance });
        if (!updated) {
          const [record] = await tx.select({ balance: user.creditBalance }).from(user).where(eq(user.id, userId)).limit(1);
          return { success: false, newBalance: parseBalance(record?.balance), error: 'Insufficient credits' };
        }
        const newBalance = parseBalance(updated.creditBalance);
        await tx.insert(creditTransaction).values({
          id: transactionId,
          userId,
          type: creditTransactionTypes.CONSUMPTION,
          amount: String(-amount),
          balance: String(newBalance),
          description: description || 'Credits consumed',
          metadata: metadata || null,
          createdAt: now,
        });
        return { success: true, newBalance, transactionId };
      });
    } catch (error) {
      const idempotent = await this.getTransaction(transactionId);
      if (idempotent && idempotent.userId === userId && parseBalance(idempotent.amount) === -amount) {
        return { success: true, newBalance: parseBalance(idempotent.balance), transactionId, idempotent: true };
      }
      return {
        success: false,
        newBalance: await this.getBalance(userId),
        error: error instanceof Error ? error.message : 'Failed to consume credits',
      };
    }
  }

  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    return (await this.getBalance(userId)) >= amount;
  }

  async getTransactions(userId: string, options: GetTransactionsOptions = {}): Promise<CreditTransaction[]> {
    const { limit = 50, offset = 0, type } = options;
    const where = type
      ? and(eq(creditTransaction.userId, userId), eq(creditTransaction.type, type))
      : eq(creditTransaction.userId, userId);
    return db.select().from(creditTransaction).where(where)
      .orderBy(desc(creditTransaction.createdAt)).limit(limit).offset(offset);
  }

  async getTransactionsPaginated(
    userId: string,
    options: GetTransactionsOptions = {},
  ): Promise<GetTransactionsPaginatedResult> {
    const { page = 1, limit = 10, type } = options;
    const offset = (page - 1) * limit;
    const where = type
      ? and(eq(creditTransaction.userId, userId), eq(creditTransaction.type, type))
      : eq(creditTransaction.userId, userId);
    const [countRow] = await db.select({ count: count() }).from(creditTransaction).where(where);
    const transactions = await db.select().from(creditTransaction).where(where)
      .orderBy(desc(creditTransaction.createdAt)).limit(limit).offset(offset);
    const total = countRow?.count || 0;
    return { transactions, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async getStatus(userId: string): Promise<{ balance: number; totalPurchased: number; totalConsumed: number }> {
    const balance = await this.getBalance(userId);
    const stats = await db.select({
      type: creditTransaction.type,
      total: sql<string>`SUM(ABS(${creditTransaction.amount}))`,
    }).from(creditTransaction).where(eq(creditTransaction.userId, userId)).groupBy(creditTransaction.type);
    let totalPurchased = 0;
    let totalConsumed = 0;
    for (const stat of stats) {
      const amount = parseBalance(stat.total);
      if (stat.type === creditTransactionTypes.PURCHASE || stat.type === creditTransactionTypes.BONUS) totalPurchased += amount;
      if (stat.type === creditTransactionTypes.CONSUMPTION) totalConsumed += amount;
    }
    return { balance, totalPurchased, totalConsumed };
  }
}

export const creditService = new CreditService();

/** Read-only ledger queries consumed by the Admin API. */
export class CreditLedgerQueryService {
  async getAllTransactionsPaginated(
    options: GetAllTransactionsOptions = {}
  ): Promise<GetTransactionsPaginatedResult> {
    const {
      page = 1,
      limit = 10,
      searchField,
      searchValue,
      type,
      userId,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = options;
    const offset = (page - 1) * limit;
    const conditions = [];

    if (searchValue && searchField) {
      if (searchField === 'id') conditions.push(eq(creditTransaction.id, searchValue));
      if (searchField === 'userId') conditions.push(eq(creditTransaction.userId, searchValue));
      if (searchField === 'userEmail') conditions.push(like(user.email, `%${searchValue}%`));
      if (searchField === 'userName') conditions.push(like(user.name, `%${searchValue}%`));
      if (searchField === 'description') conditions.push(like(creditTransaction.description, `%${searchValue}%`));
    }
    if (type) conditions.push(eq(creditTransaction.type, type));
    if (userId) conditions.push(eq(creditTransaction.userId, userId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db.select({ count: count() })
      .from(creditTransaction)
      .leftJoin(user, eq(creditTransaction.userId, user.id));
    const [countRow] = where ? await countQuery.where(where) : await countQuery;
    const total = countRow?.count || 0;

    const column = sortBy === 'id' ? creditTransaction.id
      : sortBy === 'userId' ? creditTransaction.userId
      : sortBy === 'userEmail' ? user.email
      : sortBy === 'type' ? creditTransaction.type
      : sortBy === 'amount' ? creditTransaction.amount
      : creditTransaction.createdAt;
    const orderBy = sortDirection === 'asc' ? asc(column) : desc(column);

    const dataQuery = db.select({
      id: creditTransaction.id,
      userId: creditTransaction.userId,
      type: creditTransaction.type,
      amount: creditTransaction.amount,
      balance: creditTransaction.balance,
      orderId: creditTransaction.orderId,
      description: creditTransaction.description,
      metadata: creditTransaction.metadata,
      createdAt: creditTransaction.createdAt,
      userEmail: user.email,
      userName: user.name,
    }).from(creditTransaction).leftJoin(user, eq(creditTransaction.userId, user.id));
    const transactions = where
      ? await dataQuery.where(where).orderBy(orderBy).limit(limit).offset(offset)
      : await dataQuery.orderBy(orderBy).limit(limit).offset(offset);

    return { transactions, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }
}

export const creditLedgerQueryService = new CreditLedgerQueryService();
