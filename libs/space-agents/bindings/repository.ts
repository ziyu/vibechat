import type { SpaceAgentBindingSnapshot } from '@vibechat/space-agent-contracts'

export interface SpaceAgentBindingRepository {
  findBinding(spaceInstanceId: string, agentId: string): Promise<SpaceAgentBindingSnapshot | null>
  findDefaultBinding(spaceInstanceId: string): Promise<SpaceAgentBindingSnapshot | null>
  listBindings(spaceInstanceId: string): Promise<SpaceAgentBindingSnapshot[]>
  upsertBinding(binding: SpaceAgentBindingSnapshot): Promise<void>
}
