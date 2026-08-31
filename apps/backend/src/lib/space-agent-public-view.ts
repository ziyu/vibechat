import type { SpaceInstanceRecord } from '@libs/rooms/types'
import {
  SpaceAgentBindingService,
  SpaceAgentRegistryService,
} from '@libs/space-agents'

export async function loadSpaceAgentPublicView(instance: SpaceInstanceRecord) {
  const { DatabaseSpaceAgentRepository } = await import(
    '@libs/space-agents/database-repository'
  )
  const repository = new DatabaseSpaceAgentRepository()
  const snapshot = await new SpaceAgentBindingService(
    repository,
    new SpaceAgentRegistryService(repository),
  ).getPublicSnapshot({
    spaceInstanceId: instance.spaceInstanceId,
    legacyDefaultAgentId: instance.defaultAgentId,
  })
  return {
    ...snapshot,
    availableAgents: snapshot.agents.map(({ binding, definition }) => ({
      id: binding.agentId,
      name: definition?.displayName || binding.agentId,
      available: binding.status === 'active'
        && definition?.status === 'active'
        && definition.availability !== 'unavailable',
    })),
  }
}
