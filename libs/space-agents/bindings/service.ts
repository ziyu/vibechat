import type {
  AgentDefinitionSnapshot,
  SpaceAgentPublicView,
  SpaceAgentBindingSnapshot,
} from '@vibechat/space-agent-contracts'
import {
  createDefaultPiBinding,
  defaultPiAgentId,
} from '../bootstrap'
import type { SpaceAgentRegistryService } from '../registry/service'
import type { SpaceAgentBindingRepository } from './repository'

export type SpaceAgentResolution =
  | {
      status: 'resolved'
      source: 'binding' | 'legacy_default' | 'pi_bootstrap'
      agentId: string
      definition: AgentDefinitionSnapshot
      binding: SpaceAgentBindingSnapshot | null
    }
  | {
      status: 'denied'
      reason: 'binding_disabled' | 'agent_not_bound' | 'definition_unavailable'
      agentId: string
    }

export class SpaceAgentBindingService {
  constructor(
    private readonly bindings: SpaceAgentBindingRepository,
    private readonly registry: SpaceAgentRegistryService,
  ) {}

  async resolveForInvocation(input: {
    spaceInstanceId: string
    requestedAgentId?: string
    legacyDefaultAgentId?: string | null
  }): Promise<SpaceAgentResolution> {
    const binding = input.requestedAgentId
      ? await this.bindings.findBinding(input.spaceInstanceId, input.requestedAgentId)
      : await this.bindings.findDefaultBinding(input.spaceInstanceId)

    if (binding) {
      if (binding.status !== 'active') {
        return {
          status: 'denied',
          reason: 'binding_disabled',
          agentId: binding.agentId,
        }
      }
      const definition = await this.registry.resolveDefinition({
        agentId: binding.agentId,
        definitionId: binding.definitionId,
      })
      if (
        !definition
        || definition.status !== 'active'
        || definition.availability === 'unavailable'
        || definition.version !== binding.definitionVersion
      ) {
        return {
          status: 'denied',
          reason: 'definition_unavailable',
          agentId: binding.agentId,
        }
      }
      return {
        status: 'resolved',
        source: 'binding',
        agentId: binding.agentId,
        definition,
        binding,
      }
    }

    const legacyAgentId = input.legacyDefaultAgentId || null
    const fallbackAgentId = input.requestedAgentId || legacyAgentId || defaultPiAgentId
    if (input.requestedAgentId && input.requestedAgentId !== legacyAgentId) {
      return {
        status: 'denied',
        reason: 'agent_not_bound',
        agentId: input.requestedAgentId,
      }
    }

    const definition = await this.registry.resolveDefinition({ agentId: fallbackAgentId })
    if (
      !definition
      || definition.status !== 'active'
      || definition.availability === 'unavailable'
    ) {
      return {
        status: 'denied',
        reason: 'definition_unavailable',
        agentId: fallbackAgentId,
      }
    }
    return {
      status: 'resolved',
      source: legacyAgentId ? 'legacy_default' : 'pi_bootstrap',
      agentId: fallbackAgentId,
      definition,
      binding: null,
    }
  }

  async getPublicSnapshot(input: {
    spaceInstanceId: string
    legacyDefaultAgentId?: string | null
    now?: Date
  }): Promise<{
    defaultAgentId: string
    agents: SpaceAgentPublicView[]
  }> {
    let bindings = await this.bindings.listBindings(input.spaceInstanceId)
    if (
      bindings.length === 0
      && (!input.legacyDefaultAgentId || input.legacyDefaultAgentId === defaultPiAgentId)
    ) {
      bindings = [createDefaultPiBinding(input.spaceInstanceId, input.now || new Date())]
    }

    const agents = await Promise.all(bindings.map(async (binding) => {
      const definition = await this.registry.resolveDefinition({
        agentId: binding.agentId,
        definitionId: binding.definitionId,
      })
      return {
        binding: publicBinding(binding),
        definition: definition && definition.version === binding.definitionVersion
          ? publicDefinition(definition)
          : null,
      }
    }))
    return {
      defaultAgentId: bindings.find((binding) => binding.isDefault)?.agentId
        || input.legacyDefaultAgentId
        || defaultPiAgentId,
      agents,
    }
  }
}

function publicBinding(binding: SpaceAgentBindingSnapshot): SpaceAgentPublicView['binding'] {
  const {
    bindingId,
    spaceInstanceId,
    agentId,
    definitionId,
    definitionVersion,
    isDefault,
    status,
    createdAt,
    updatedAt,
  } = binding
  return {
    bindingId,
    spaceInstanceId,
    agentId,
    definitionId,
    definitionVersion,
    isDefault,
    status,
    createdAt,
    updatedAt,
  }
}

function publicDefinition(
  definition: AgentDefinitionSnapshot,
): SpaceAgentPublicView['definition'] {
  const {
    definitionId,
    agentId,
    version,
    capabilities,
    displayName,
    description,
    status,
    availability,
    createdAt,
    updatedAt,
  } = definition
  return {
    definitionId,
    agentId,
    version,
    capabilities,
    displayName,
    description,
    status,
    availability,
    createdAt,
    updatedAt,
  }
}
