import type { SpaceInstanceRecord } from '@libs/rooms/types'
import type { DatabaseSpaceAgentRepository } from '@libs/space-agents/database-repository'
import {
  createDefaultPiBinding,
  defaultPiAgentId,
  defaultPiDefinition,
} from '@libs/space-agents'

type ProvisioningRepository = Pick<
  DatabaseSpaceAgentRepository,
  'findBinding' | 'upsertBinding' | 'upsertDefinition'
>

export async function provisionDefaultSpaceAgentBinding(
  instance: Pick<SpaceInstanceRecord, 'spaceInstanceId' | 'createdAt'>,
  repository: ProvisioningRepository,
) {
  const existing = await repository.findBinding(
    instance.spaceInstanceId,
    defaultPiAgentId,
  )
  if (existing) return existing

  await repository.upsertDefinition(defaultPiDefinition)
  const binding = createDefaultPiBinding(instance.spaceInstanceId, instance.createdAt)
  await repository.upsertBinding(binding)
  return binding
}

export async function ensureDefaultSpaceAgentBinding(
  instance: Pick<SpaceInstanceRecord, 'spaceInstanceId' | 'createdAt'>,
) {
  const { DatabaseSpaceAgentRepository } = await import(
    '@libs/space-agents/database-repository'
  )
  return provisionDefaultSpaceAgentBinding(
    instance,
    new DatabaseSpaceAgentRepository(),
  )
}
