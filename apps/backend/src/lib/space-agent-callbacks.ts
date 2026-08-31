import type {
  SpaceAgentBillingCallbackV1,
  SpaceAgentCompletionCallbackV1,
} from '@vibechat/space-agent-contracts'
import type { SpaceInstanceRecord } from '@libs/rooms/types'
import type { RuntimeTurnRecord } from '@libs/space-runtime-control'

export function acceptsSpaceAgentBillingCallback(
  turn: RuntimeTurnRecord | null,
  callback: SpaceAgentBillingCallbackV1,
) {
  if (!turn) return false
  const legacyBilling = turn.payload.billing
  const legacyTransactionId = legacyBilling
    && typeof legacyBilling === 'object'
    && !Array.isArray(legacyBilling)
    && typeof (legacyBilling as Record<string, unknown>).transactionId === 'string'
    ? (legacyBilling as Record<string, unknown>).transactionId
    : null
  return turn.spaceInstanceId === callback.spaceInstanceId
    && (turn.reservationTransactionId || legacyTransactionId) === callback.transactionId
    && turn.status === callback.status
}

export function acceptsSpaceAgentCompletionCallback(
  turn: RuntimeTurnRecord | null,
  instance: Pick<SpaceInstanceRecord, 'spaceInstanceId' | 'defaultAgentId'>,
  callback: SpaceAgentCompletionCallbackV1,
) {
  return Boolean(
    turn
    && instance.spaceInstanceId === callback.spaceInstanceId
    && turn.spaceInstanceId === callback.spaceInstanceId
    && (turn.agentId || instance.defaultAgentId) === callback.agentId
    && turn.status === 'completed',
  )
}
