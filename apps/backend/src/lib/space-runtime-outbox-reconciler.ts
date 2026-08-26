import { DatabaseSpaceRuntimeControlPlane } from '@libs/space-runtime-control'
import {
  spaceAgentBillingCallbackSchema,
  spaceAgentCompletionCallbackSchema,
} from '@vibechat/api-contracts'
import { writeMatrixAgentReply } from './matrix-agent-reply'
import { writeMatrixSpaceV2State } from './matrix-space-v2-state'

let activeDrain: Promise<void> | null = null

export function reconcileSpaceRuntimeOutbox() {
  if (!activeDrain) {
    activeDrain = drain().finally(() => {
      activeDrain = null
    })
  }
  return activeDrain
}

async function drain() {
  const repository = new DatabaseSpaceRuntimeControlPlane()
  const ownerId = `backend-reconciler-${globalThis.crypto.randomUUID()}`
  const events = await repository.claimOutbox(ownerId, 20)
  for (const event of events) {
    try {
      if (event.eventType === 'agent_reply') {
        await writeMatrixAgentReply(spaceAgentCompletionCallbackSchema.parse(event.payload))
      } else if (event.eventType === 'credits_callback') {
        await deliverCredits(spaceAgentBillingCallbackSchema.parse(event.payload))
      } else if (event.eventType === 'matrix_v2_state') {
        await writeMatrixSpaceV2State(event.payload)
      }
      await repository.completeOutbox(event.eventId, ownerId)
    } catch (error) {
      const delayMs = Math.min(60_000, 500 * (2 ** Math.min(event.attempt, 7)))
      await repository.retryOutbox(
        event.eventId,
        ownerId,
        new Date(Date.now() + delayMs),
      )
      console.error('[space-runtime-outbox] delivery failed', {
        eventId: event.eventId,
        eventType: event.eventType,
        attempt: event.attempt,
        errorName: error instanceof Error ? error.name : 'Error',
      })
    }
  }
}

async function deliverCredits(
  callback: ReturnType<typeof spaceAgentBillingCallbackSchema.parse>,
) {
  const ai = await import('@libs/ai')
  const context = {
    userId: callback.userId,
    requestId: callback.requestId,
    provider: callback.provider,
    model: callback.model,
  }
  const reservation = {
    reservedCredits: callback.reservedCredits,
    transactionId: callback.transactionId,
  }
  if (callback.status === 'failed') {
    await ai.refundChatCredits(context, reservation, 'space_agent_failed')
  } else {
    await ai.settleChatCredits(context, reservation, callback.usage || {})
  }
}
