import type { AgentDefinitionSnapshot } from '@vibechat/space-agent-contracts'

export interface SpaceAgentDefinitionRepository {
  findDefinition(definitionId: string): Promise<AgentDefinitionSnapshot | null>
  findDefinitionByAgentVersion(agentId: string, version: string): Promise<AgentDefinitionSnapshot | null>
  findActiveDefinitionByAgentId(agentId: string): Promise<AgentDefinitionSnapshot | null>
  listDefinitions(): Promise<AgentDefinitionSnapshot[]>
  upsertDefinition(definition: AgentDefinitionSnapshot): Promise<void>
  updateDefinitionStatus(
    definitionId: string,
    status: AgentDefinitionSnapshot['status'],
    updatedAt: Date,
  ): Promise<void>
}
