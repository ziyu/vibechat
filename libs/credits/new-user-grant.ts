import { config } from '@config'
import type { CreditTransaction } from '@libs/database/schema/credit-transaction'
import { creditService } from './service'
import { TransactionTypeCode } from './utils'

const grantVersion = 1

/**
 * Grant the configured account-creation credits exactly once.
 *
 * The stable transaction id makes retries from auth hooks safe across all
 * supported database dialects while preserving an auditable ledger entry.
 */
export async function grantNewUserCredits(
  userId: string,
): Promise<CreditTransaction | null> {
  const amount = config.credits.newUserGrant
  if (amount === 0) return null

  return creditService.addCredits({
    userId,
    amount,
    type: 'bonus',
    description: TransactionTypeCode.NEW_USER_BONUS,
    metadata: {
      source: 'auth_user_created',
      grantVersion,
    },
    transactionId: `signup:welcome:${userId}`,
  })
}
