import { describe, expect, it, vi } from 'vitest'
import type { ClaimedSpaceTurn } from '../../../apps/space-runtime/src/space-instance-server'
import {
  parseBilling,
  reportTurnBilling,
  reportTurnCompletion,
} from '../../../apps/space-runtime/src/turn-callbacks'

function claimedTurn(): ClaimedSpaceTurn {
  return {
    turnId: 'turn-batch-1',
    kind: 'message',
    requests: [1, 2].map((index) => ({
      turnId: 'turn-batch-1',
      kind: 'message' as const,
      clientId: `member-${index}`,
      authorName: `Member ${index}`,
      text: `request ${index}`,
      createdAt: '2026-08-25T00:00:00.000Z',
      externalRequestId: `$matrix-event-${index}`,
      agentId: 'pi',
      billing: {
        callbackUrl: 'http://backend.test/v1/internal/space-agent-billing',
        spaceInstanceId: 'space-instance-1',
        completion: {
          callbackUrl: 'http://backend.test/v1/internal/space-agent-completion',
          spaceInstanceId: 'space-instance-1',
          matrixRoomId: '!space:localhost',
          matrixEventId: `$matrix-event-${index}`,
        },
        userId: `user-${index}`,
        requestId: `request-${index}`,
        provider: 'space-agent',
        model: 'pi',
        reservedCredits: 4,
        transactionId: `transaction-${index}`,
      },
    })),
  }
}

describe('Space turn callbacks', () => {
  it('validates billing and completion delivery URLs without throwing', () => {
    expect(parseBilling({ callbackUrl: 'not-a-url' })).toBeNull()
    expect(parseBilling({
      callbackUrl: 'http://backend.test/billing',
      spaceInstanceId: 'space-instance-1',
      completion: {
        callbackUrl: 'file:///tmp/callback',
        spaceInstanceId: 'space-instance-1',
        matrixRoomId: '!space:localhost',
        matrixEventId: '$event-1',
      },
      userId: 'user-1',
      requestId: 'request-1',
      provider: 'space-agent',
      model: 'pi',
      reservedCredits: 4,
      transactionId: 'transaction-1',
    })).toBeNull()
  })

  it('settles each reservation but reports one Matrix completion per batch', async () => {
    const turn = claimedTurn()
    const billingFetch = vi.fn(async () => Response.json({ ok: true }))
    await reportTurnBilling({
      turn,
      status: 'completed',
      usage: { inputTokens: 7, outputTokens: 5, totalTokens: 12 },
      signingSecret: 'test-space-runtime-signing-secret-32',
      fetch: billingFetch as unknown as typeof globalThis.fetch,
    })

    expect(billingFetch).toHaveBeenCalledTimes(2)
    for (const [, init] of billingFetch.mock.calls) {
      const payload = JSON.parse(String(init?.body))
      expect(payload).toMatchObject({
        spaceInstanceId: 'space-instance-1',
        turnId: 'turn-batch-1',
      })
      expect(payload).not.toHaveProperty('completion')
    }

    const completionFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'retry' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true }))
    await reportTurnCompletion({
      turn,
      reply: { agentId: 'pi', agentName: 'Pi', text: 'Batch complete.' },
      signingSecret: 'test-space-runtime-signing-secret-32',
      fetch: completionFetch as unknown as typeof globalThis.fetch,
    })

    expect(completionFetch).toHaveBeenCalledTimes(2)
    const payload = JSON.parse(String(completionFetch.mock.calls[1]?.[1]?.body))
    expect(payload).toMatchObject({
      userId: 'user-1',
      turnId: 'turn-batch-1',
      agentId: 'pi',
      sourceEventIds: ['$matrix-event-1', '$matrix-event-2'],
      reply: { text: 'Batch complete.' },
    })
  })
})
