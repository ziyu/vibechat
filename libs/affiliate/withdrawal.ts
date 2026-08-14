import { db, isD1Dialect, isSqliteDialect, runNativeD1Batch } from '@libs/database';
import { user, withdrawal, withdrawalStatus } from '@libs/database/schema';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { config } from '@config';
import { nanoid } from 'nanoid';
import type {
  ProcessWithdrawalParams,
  ProcessWithdrawalResult,
  RequestWithdrawalParams,
  RequestWithdrawalResult,
} from './types';

export async function requestWithdrawal(
  params: RequestWithdrawalParams,
): Promise<RequestWithdrawalResult> {
  const { userId, amount, paymentMethod, paymentAccount } = params;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Invalid withdrawal amount' };
  }
  if (amount < config.affiliate.minWithdrawalAmount) {
    return { success: false, error: `Minimum withdrawal amount is ${config.affiliate.minWithdrawalAmount}` };
  }

  const [account] = await db.select({
    commissionBalance: user.commissionBalance,
    kycVerified: user.kycVerified,
  }).from(user).where(eq(user.id, userId)).limit(1);
  if (!account) return { success: false, error: 'User not found' };
  if (!account.kycVerified) return { success: false, error: 'KYC verification required' };

  const withdrawalId = params.requestId || `wd_${nanoid()}`;
  const [existing] = await db.select({ id: withdrawal.id, userId: withdrawal.userId })
    .from(withdrawal).where(eq(withdrawal.id, withdrawalId)).limit(1);
  if (existing) {
    return existing.userId === userId
      ? { success: true, withdrawalId, idempotent: true }
      : { success: false, error: 'Withdrawal request id collision' };
  }

  const now = new Date();
  try {
    if (isD1Dialect()) {
      const epoch = Math.floor(now.getTime() / 1000);
      const [updated] = await runNativeD1Batch([
        {
          sql: `UPDATE user
                SET commission_balance = CAST(COALESCE(commission_balance, '0') AS REAL) - ?, updated_at = ?
                WHERE id = ? AND kyc_verified = 1
                  AND CAST(COALESCE(commission_balance, '0') AS REAL) >= ?
                RETURNING id`,
          params: [amount, epoch, userId, amount],
        },
        {
          sql: `INSERT INTO withdrawal
                  (id, user_id, amount, currency, payment_method, payment_account, status, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
                WHERE changes() > 0`,
          params: [withdrawalId, userId, String(amount), config.affiliate.currency,
            paymentMethod, paymentAccount, withdrawalStatus.PENDING, epoch, epoch],
        },
      ]);
      return (updated?.results ?? []).length > 0
        ? { success: true, withdrawalId }
        : { success: false, error: 'Insufficient commission balance' };
    }

    if (isSqliteDialect()) {
      let reserved = false;
      (db as any).transaction((tx: any) => {
        const rows = tx.update(user).set({
          commissionBalance: sql`CAST(COALESCE(${user.commissionBalance}, '0') AS REAL) - ${amount}`,
          updatedAt: now,
        }).where(and(
          eq(user.id, userId),
          eq(user.kycVerified, true),
          sql`CAST(COALESCE(${user.commissionBalance}, '0') AS REAL) >= ${amount}`,
        )).returning({ id: user.id }).all();
        if (rows.length === 0) return;
        tx.insert(withdrawal).values({
          id: withdrawalId,
          userId,
          amount: String(amount),
          currency: config.affiliate.currency,
          paymentMethod,
          paymentAccount,
          status: withdrawalStatus.PENDING,
          createdAt: now,
          updatedAt: now,
        }).run();
        reserved = true;
      });
      return reserved
        ? { success: true, withdrawalId }
        : { success: false, error: 'Insufficient commission balance' };
    }

    const reserved = await db.transaction(async (tx) => {
      const rows = await tx.update(user).set({
        commissionBalance: sql`CAST(COALESCE(${user.commissionBalance}, '0') AS DECIMAL) - ${amount}`,
        updatedAt: now,
      }).where(and(
        eq(user.id, userId),
        eq(user.kycVerified, true),
        sql`CAST(COALESCE(${user.commissionBalance}, '0') AS DECIMAL) >= ${amount}`,
      )).returning({ id: user.id });
      if (rows.length === 0) return false;
      await tx.insert(withdrawal).values({
        id: withdrawalId,
        userId,
        amount: String(amount),
        currency: config.affiliate.currency,
        paymentMethod,
        paymentAccount,
        status: withdrawalStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      });
      return true;
    });
    return reserved
      ? { success: true, withdrawalId }
      : { success: false, error: 'Insufficient commission balance' };
  } catch (error) {
    const [idempotent] = await db.select({ userId: withdrawal.userId })
      .from(withdrawal).where(eq(withdrawal.id, withdrawalId)).limit(1);
    if (idempotent?.userId === userId) return { success: true, withdrawalId, idempotent: true };
    throw error;
  }
}

/**
 * Process an existing withdrawal as an Admin operation.
 * Rejection refunds the previously reserved amount exactly once.
 */
export async function processWithdrawal(
  params: ProcessWithdrawalParams
): Promise<ProcessWithdrawalResult> {
  const { withdrawalId, status, adminNote, processedBy } = params;
  const [record] = await db
    .select()
    .from(withdrawal)
    .where(eq(withdrawal.id, withdrawalId))
    .limit(1);

  if (!record) return { success: false, error: 'Withdrawal not found' };
  if (record.status === withdrawalStatus.COMPLETED || record.status === withdrawalStatus.REJECTED) {
    return { success: false, error: 'Withdrawal already processed' };
  }

  const now = new Date();
  const amount = Number(record.amount);
  if (status === withdrawalStatus.REJECTED && !Number.isFinite(amount)) {
    return { success: false, error: 'Invalid withdrawal amount' };
  }

  if (isD1Dialect() && status === withdrawalStatus.REJECTED) {
    const epoch = Math.floor(now.getTime() / 1000);
    const [claimResult] = await runNativeD1Batch([
      {
        sql: `UPDATE withdrawal
              SET status = ?, admin_note = ?, processed_by = ?, processed_at = ?, updated_at = ?
              WHERE id = ? AND status NOT IN (?, ?)
              RETURNING id`,
        params: [status, adminNote || null, processedBy, epoch, epoch, withdrawalId,
          withdrawalStatus.COMPLETED, withdrawalStatus.REJECTED],
      },
      {
        sql: `UPDATE user
              SET commission_balance = CAST(COALESCE(commission_balance, '0') AS REAL) + ?, updated_at = ?
              WHERE id = ? AND changes() > 0`,
        params: [amount, epoch, record.userId],
      },
    ]);
    return (claimResult?.results ?? []).length > 0
      ? { success: true }
      : { success: false, error: 'Withdrawal already processed' };
  }

  if (isSqliteDialect()) {
    let claimed = false;
    (db as any).transaction((tx: any) => {
      const rows = tx.update(withdrawal)
        .set({ status, adminNote: adminNote || null, processedBy, processedAt: now, updatedAt: now })
        .where(and(
          eq(withdrawal.id, withdrawalId),
          notInArray(withdrawal.status, [withdrawalStatus.COMPLETED, withdrawalStatus.REJECTED]),
        ))
        .returning({ id: withdrawal.id })
        .all();
      if (rows.length === 0) return;
      claimed = true;
      if (status === withdrawalStatus.REJECTED) {
        tx.update(user)
          .set({
            commissionBalance: sql`CAST(COALESCE(${user.commissionBalance}, '0') AS REAL) + ${amount}`,
            updatedAt: now,
          })
          .where(eq(user.id, record.userId))
          .run();
      }
    });
    return claimed ? { success: true } : { success: false, error: 'Withdrawal already processed' };
  }

  const claimed = await db.transaction(async (tx) => {
    const rows = await tx.update(withdrawal)
      .set({ status, adminNote: adminNote || null, processedBy, processedAt: now, updatedAt: now })
      .where(and(
        eq(withdrawal.id, withdrawalId),
        notInArray(withdrawal.status, [withdrawalStatus.COMPLETED, withdrawalStatus.REJECTED]),
      ))
      .returning({ id: withdrawal.id });
    if (rows.length === 0) return false;
    if (status === withdrawalStatus.REJECTED) {
      await tx.update(user)
        .set({
          commissionBalance: sql`CAST(COALESCE(${user.commissionBalance}, '0') AS REAL) + ${amount}`,
          updatedAt: now,
        })
        .where(eq(user.id, record.userId));
    }
    return true;
  });
  return claimed ? { success: true } : { success: false, error: 'Withdrawal already processed' };
}
