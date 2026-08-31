import type { AgentSessionRefV1 } from '@vibechat/space-agent-contracts'

export interface SpaceAgentSessionRepository {
  findSession(sessionId: string): Promise<AgentSessionRefV1 | null>
  findLatestSession(spaceInstanceId: string, agentId: string): Promise<AgentSessionRefV1 | null>
  saveSession(session: AgentSessionRefV1): Promise<void>
}
