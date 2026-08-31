import type { AgentDefinitionSnapshot } from '@vibechat/space-agent-contracts'
import { defaultPiAgentId, defaultPiDefinition } from '../bootstrap'
import type { SpaceAgentDefinitionRepository } from './repository'

export class SpaceAgentRegistryService {
  constructor(private readonly repository: SpaceAgentDefinitionRepository) {}

  async resolveDefinition(input: {
    agentId: string
    definitionId?: string
  }): Promise<AgentDefinitionSnapshot | null> {
    const stored = input.definitionId
      ? await this.repository.findDefinition(input.definitionId)
      : await this.repository.findActiveDefinitionByAgentId(input.agentId)
    if (stored) {
      return stored.agentId === input.agentId ? stored : null
    }
    return input.agentId === defaultPiAgentId && (
      !input.definitionId || input.definitionId === defaultPiDefinition.definitionId
    ) ? defaultPiDefinition : null
  }
}
