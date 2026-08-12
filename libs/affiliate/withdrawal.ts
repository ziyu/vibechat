import { db, isD1Dialect, isSqliteDialect, runNativeD1Batch } from '@libs/database';
import { user, withdrawal, withdrawalStatus } from '@libs/database/schema';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { ProcessWithdrawalParams, ProcessWithdrawalResult } from './types';

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
