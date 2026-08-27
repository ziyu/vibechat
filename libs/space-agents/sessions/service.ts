import type {
  AgentDefinitionSnapshot,
  AgentSessionRefV1,
} from '@vibechat/space-agent-contracts'
import type { SpaceAgentSessionRepository } from './repository'

export class SpaceAgentSessionService {
  constructor(
    private readonly repository: SpaceAgentSessionRepository,
    private readonly createId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  async getOrCreate(input: {
    spaceInstanceId: string
    definition: AgentDefinitionSnapshot
    region: string
    now?: Date
  }): Promise<AgentSessionRefV1> {
    const current = await this.repository.findLatestSession(
      input.spaceInstanceId,
      input.definition.agentId,
    )
    if (current && this.canReuse(current, input.definition, input.region)) return current

    const timestamp = (input.now || new Date()).toISOString()
    const session: AgentSessionRefV1 = {
      schemaVersion: 'vibechat.agent-session-ref/v1',
      sessionId: this.createId(),
      spaceInstanceId: input.spaceInstanceId,
      agentId: input.definition.agentId,
      definitionId: input.definition.definitionId,
      definitionVersion: input.definition.version,
      adapterKey: input.definition.adapterKey,
      adapterVersion: input.definition.adapterVersion,
      generation: (current?.generation || 0) + 1,
      providerSessionRef: null,
      summaryRef: null,
      summaryHash: null,
      region: input.region,
      restoreStatus: 'ready',
      lastTurnId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.repository.saveSession(session)
    return session
  }

  private canReuse(
    session: AgentSessionRefV1,
    definition: AgentDefinitionSnapshot,
    region: string,
  ) {
    return session.definitionId === definition.definitionId
      && session.definitionVersion === definition.version
      && session.adapterKey === definition.adapterKey
      && session.adapterVersion === definition.adapterVersion
      && session.region === region
      && session.restoreStatus !== 'closed'
      && session.restoreStatus !== 'failed'
  }
}
