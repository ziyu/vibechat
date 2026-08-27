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
      restoreStatus: 'restoring',
      lastTurnId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.repository.saveSession(session)
    return await this.repository.findLatestSession(
      input.spaceInstanceId,
      input.definition.agentId,
    ) || session
  }

  async rebuild(input: {
    session: AgentSessionRefV1
    now?: Date
  }): Promise<AgentSessionRefV1> {
    const latest = await this.repository.findLatestSession(
      input.session.spaceInstanceId,
      input.session.agentId,
    )
    if (latest && latest.generation > input.session.generation) return latest
    if (
      latest
      && latest.generation === input.session.generation
      && latest.sessionId !== input.session.sessionId
    ) {
      throw new Error('Agent session generation identity conflict')
    }

    const timestamp = (input.now || new Date()).toISOString()
    const session: AgentSessionRefV1 = {
      ...input.session,
      sessionId: this.createId(),
      generation: input.session.generation + 1,
      providerSessionRef: null,
      restoreStatus: 'restoring',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.repository.saveSession(session)
    return await this.repository.findLatestSession(
      input.session.spaceInstanceId,
      input.session.agentId,
    ) || session
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
      && (session.restoreStatus === 'ready' || session.restoreStatus === 'restoring')
  }
}
