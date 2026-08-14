import { APIError } from 'better-auth/api'
import { checkSubscriptionStatus } from '@libs/database/utils/subscription'

/** Prevent local deletion while an external recurring plan can still charge. */
export async function assertAccountDeletionAllowed(userId: string): Promise<void> {
  const active = await checkSubscriptionStatus(userId)
  const externalRecurring = active?.paymentType === 'recurring' && Boolean(
    active.stripeSubscriptionId
    || active.creemSubscriptionId
    || active.paypalSubscriptionId
    || active.dodoSubscriptionId,
  )
  if (externalRecurring) {
    throw new APIError('BAD_REQUEST', {
      code: 'ACTIVE_SUBSCRIPTION',
      message: 'Cancel the active subscription before deleting this account',
    })
  }
}
