import type { AgentDefinitionSnapshot } from '@vibechat/space-agent-contracts'

export interface SpaceAgentDefinitionRepository {
  findDefinition(definitionId: string): Promise<AgentDefinitionSnapshot | null>
  findActiveDefinitionByAgentId(agentId: string): Promise<AgentDefinitionSnapshot | null>
  upsertDefinition(definition: AgentDefinitionSnapshot): Promise<void>
}
