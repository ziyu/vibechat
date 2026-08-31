import type { SpaceRuntimeControlPlane } from '@libs/space-runtime-control'
import {
  spaceAgentTurnCancellationSchema,
  type SpaceAgentTurnCancellation,
} from '@vibechat/api-contracts'

export interface SpaceAgentCancellationDependencies {
  control: Pick<
    SpaceRuntimeControlPlane,
    'getTurn' | 'requestTurnCancellation'
  >
  now(): Date
}

export class SpaceAgentCancellationError extends Error {
  constructor(
    readonly status: 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SpaceAgentCancellationError'
  }
}

export class SpaceAgentCancellationService {
  constructor(private readonly dependencies: SpaceAgentCancellationDependencies) {}

  async cancel(input: {
    spaceInstanceId: string
    userId: string
    turnId: string
  }): Promise<SpaceAgentTurnCancellation> {
    const turn = await this.dependencies.control.getTurn(input.turnId)
    if (
      !turn
      || turn.spaceInstanceId !== input.spaceInstanceId
      || !turn.agentId
      || turn.payload.clientId !== input.userId
    ) {
      throw new SpaceAgentCancellationError(
        404,
        'SPACE_AGENT_TURN_NOT_FOUND',
        'The Agent turn is unavailable to this account.',
      )
    }

    const requestedAt = await this.dependencies.control.requestTurnCancellation(
      turn.turnId,
      this.dependencies.now(),
    )
    if (!requestedAt) {
      throw new SpaceAgentCancellationError(
        409,
        'SPACE_AGENT_TURN_NOT_CANCELLABLE',
        'The Agent turn can no longer be cancelled.',
      )
    }

    return spaceAgentTurnCancellationSchema.parse({
      accepted: true,
      turnId: turn.turnId,
      cancelRequestedAt: requestedAt.toISOString(),
    })
  }
}

export async function createSpaceAgentCancellationService() {
  const { DatabaseSpaceRuntimeControlPlane } = await import(
    '@libs/space-runtime-control/database-repository'
  )
  return new SpaceAgentCancellationService({
    control: new DatabaseSpaceRuntimeControlPlane(),
    now: () => new Date(),
  })
}
