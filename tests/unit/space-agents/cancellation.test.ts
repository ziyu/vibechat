import { describe, expect, it, vi } from 'vitest'
import type { RuntimeTurnRecord } from '../../../libs/space-runtime-control'
import {
  SpaceAgentCancellationService,
  type SpaceAgentCancellationDependencies,
} from '../../../apps/backend/src/lib/space-agent-cancellation'

const requestedAt = new Date('2026-08-27T12:00:00.000Z')

describe('SpaceAgentCancellationService', () => {
  it('persists an asynchronous cancellation for the member who owns the Agent Turn', async () => {
    const dependencies = createDependencies()

    await expect(cancel(dependencies)).resolves.toEqual({
      accepted: true,
      turnId: 'turn-1',
      cancelRequestedAt: requestedAt.toISOString(),
    })
    expect(dependencies.control.requestTurnCancellation).toHaveBeenCalledWith(
      'turn-1',
      requestedAt,
    )
  })

  it('hides cross-Space and cross-member Turns without mutating them', async () => {
    for (const turn of [
      createTurn({ spaceInstanceId: 'space-2' }),
      createTurn({ payload: { clientId: 'user-2' } }),
      createTurn({ agentId: null }),
    ]) {
      const dependencies = createDependencies({ turn })
      await expect(cancel(dependencies)).rejects.toMatchObject({
        status: 404,
        code: 'SPACE_AGENT_TURN_NOT_FOUND',
      })
      expect(dependencies.control.requestTurnCancellation).not.toHaveBeenCalled()
    }
  })

  it('returns the original cancellation timestamp on an idempotent retry', async () => {
    const dependencies = createDependencies({
      turn: createTurn({ status: 'failed', cancelRequestedAt: requestedAt }),
    })

    await expect(cancel(dependencies)).resolves.toMatchObject({
      cancelRequestedAt: requestedAt.toISOString(),
    })
  })

  it('rejects a terminal Turn that was not previously cancelled', async () => {
    const dependencies = createDependencies({ cancellation: null })

    await expect(cancel(dependencies)).rejects.toMatchObject({
      status: 409,
      code: 'SPACE_AGENT_TURN_NOT_CANCELLABLE',
    })
  })
})

function cancel(dependencies: SpaceAgentCancellationDependencies) {
  return new SpaceAgentCancellationService(dependencies).cancel({
    spaceInstanceId: 'space-1',
    userId: 'user-1',
    turnId: 'turn-1',
  })
}

function createDependencies(input: {
  turn?: RuntimeTurnRecord
  cancellation?: Date | null
} = {}): SpaceAgentCancellationDependencies {
  return {
    control: {
      getTurn: vi.fn().mockResolvedValue(input.turn || createTurn()),
      requestTurnCancellation: vi.fn().mockResolvedValue(
        input.cancellation === undefined ? requestedAt : input.cancellation,
      ),
    },
    now: () => requestedAt,
  }
}

function createTurn(
  overrides: Partial<RuntimeTurnRecord> = {},
): RuntimeTurnRecord {
  return {
    turnId: 'turn-1',
    spaceInstanceId: 'space-1',
    externalRequestId: '$event-1',
    kind: 'message',
    status: 'active',
    agentId: 'pi',
    agentDefinitionId: 'definition-pi',
    agentDefinitionVersion: '1.0.0',
    adapterKey: 'pi',
    adapterVersion: '1.0.0',
    sessionGeneration: 1,
    policySnapshotHash: `sha256:${'a'.repeat(64)}`,
    reservationTransactionId: 'reservation-1',
    payloadSchemaVersion: 'vibechat.agent-turn-input/v1',
    payload: { clientId: 'user-1' },
    resultSchemaVersion: null,
    result: null,
    cancelRequestedAt: null,
    attempt: 1,
    ownerId: 'runtime-1',
    fencingToken: 1,
    createdAt: requestedAt,
    updatedAt: requestedAt,
    ...overrides,
  }
}
