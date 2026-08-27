import type { AgentSessionRefV1 } from '@vibechat/space-agent-contracts'

export interface SpaceAgentSessionRepository {
  findLatestSession(spaceInstanceId: string, agentId: string): Promise<AgentSessionRefV1 | null>
  saveSession(session: AgentSessionRefV1): Promise<void>
}
