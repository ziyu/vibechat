import { describe, expect, it } from 'vitest'
import type { RuntimeTurnRecord } from '../../../libs/space-runtime-control/contracts'
import {
  acceptsSpaceAgentBillingCallback,
  acceptsSpaceAgentCompletionCallback,
} from '../../../apps/backend/src/lib/space-agent-callbacks'

const timestamp = new Date('2026-08-27T00:00:00.000Z')

describe('Space Agent callback fencing', () => {
  it('uses the pinned reservation transaction before the legacy payload', () => {
    const turn = createTurn({
      reservationTransactionId: 'reservation-fixed',
      payload: { billing: { transactionId: 'reservation-legacy' } },
    })
    expect(acceptsSpaceAgentBillingCallback(turn, billing('reservation-fixed'))).toBe(true)
    expect(acceptsSpaceAgentBillingCallback(turn, billing('reservation-legacy'))).toBe(false)
  })

  it('keeps the legacy billing payload fallback for pre-S3 Turns', () => {
    const turn = createTurn({
      reservationTransactionId: null,
      payload: { billing: { transactionId: 'reservation-legacy' } },
    })
    expect(acceptsSpaceAgentBillingCallback(turn, billing('reservation-legacy'))).toBe(true)
  })

  it('uses the pinned Agent before the legacy default and preserves its fallback', () => {
    const callback = completion('agent-fixed')
    expect(acceptsSpaceAgentCompletionCallback(
      createTurn({ agentId: 'agent-fixed' }),
      { spaceInstanceId: 'space-1', defaultAgentId: 'pi' },
      callback,
    )).toBe(true)
    expect(acceptsSpaceAgentCompletionCallback(
      createTurn({ agentId: 'other-agent' }),
      { spaceInstanceId: 'space-1', defaultAgentId: 'agent-fixed' },
      callback,
    )).toBe(false)
    expect(acceptsSpaceAgentCompletionCallback(
      createTurn({ agentId: null }),
      { spaceInstanceId: 'space-1', defaultAgentId: 'agent-fixed' },
      callback,
    )).toBe(true)
  })
})

function createTurn(overrides: Partial<RuntimeTurnRecord> = {}): RuntimeTurnRecord {
  return {
    turnId: 'turn-1',
    spaceInstanceId: 'space-1',
    externalRequestId: '$matrix-event-1',
    kind: 'message',
    status: 'completed',
    agentId: 'pi',
    agentDefinitionId: null,
    agentDefinitionVersion: null,
    adapterKey: null,
    adapterVersion: null,
    sessionGeneration: null,
    policySnapshotHash: null,
    reservationTransactionId: null,
    payloadSchemaVersion: null,
    payload: {},
    resultSchemaVersion: null,
    result: null,
    cancelRequestedAt: null,
    attempt: 1,
    ownerId: 'runtime-1',
    fencingToken: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function billing(transactionId: string) {
  return {
    schemaVersion: 'vibechat.space-agent-billing/v1' as const,
    spaceInstanceId: 'space-1',
    turnId: 'turn-1',
    userId: 'user-1',
    requestId: 'request-1',
    provider: 'space-agent',
    model: 'pi',
    reservedCredits: 5,
    transactionId,
    status: 'completed' as const,
    usage: null,
    error: null,
  }
}

function completion(agentId: string) {
  return {
    schemaVersion: 'vibechat.space-agent-completion/v1' as const,
    spaceInstanceId: 'space-1',
    matrixRoomId: '!space:localhost',
    matrixEventId: '$matrix-event-1',
    turnId: 'turn-1',
    agentId,
    status: 'completed' as const,
    message: 'Done',
    usage: null,
  }
}
