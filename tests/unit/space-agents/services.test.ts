import { describe, expect, it } from 'vitest'
import type {
  AgentDefinitionSnapshot,
  AgentSessionRefV1,
  SpaceAgentBindingSnapshot,
} from '../../../packages/space-agent-contracts/src'
import {
  createDefaultPiBinding,
  defaultPiDefinition,
  SpaceAgentBindingService,
  SpaceAgentRegistryService,
  SpaceAgentSessionService,
} from '../../../libs/space-agents'
import type {
  SpaceAgentBindingRepository,
  SpaceAgentDefinitionRepository,
  SpaceAgentSessionRepository,
} from '../../../libs/space-agents'

class MemoryRepository implements
  SpaceAgentDefinitionRepository,
  SpaceAgentBindingRepository,
  SpaceAgentSessionRepository {
  definitions = new Map<string, AgentDefinitionSnapshot>()
  bindings = new Map<string, SpaceAgentBindingSnapshot>()
  sessions: AgentSessionRefV1[] = []

  async findDefinition(definitionId: string) {
    return this.definitions.get(definitionId) || null
  }

  async findActiveDefinitionByAgentId(agentId: string) {
    return [...this.definitions.values()].find((definition) => (
      definition.agentId === agentId && definition.status === 'active'
    )) || null
  }

  async upsertDefinition(definition: AgentDefinitionSnapshot) {
    this.definitions.set(definition.definitionId, definition)
  }

  async findBinding(spaceInstanceId: string, agentId: string) {
    return this.bindings.get(`${spaceInstanceId}:${agentId}`) || null
  }

  async findDefaultBinding(spaceInstanceId: string) {
    return [...this.bindings.values()].find((binding) => (
      binding.spaceInstanceId === spaceInstanceId && binding.isDefault
    )) || null
  }

  async upsertBinding(binding: SpaceAgentBindingSnapshot) {
    this.bindings.set(`${binding.spaceInstanceId}:${binding.agentId}`, binding)
  }

  async findLatestSession(spaceInstanceId: string, agentId: string) {
    return [...this.sessions].reverse().find((session) => (
      session.spaceInstanceId === spaceInstanceId && session.agentId === agentId
    )) || null
  }

  async saveSession(session: AgentSessionRefV1) {
    this.sessions.push(session)
  }
}

describe('Space Agent domain services', () => {
  it('resolves binding before legacy default and bootstrap sources', async () => {
    const repository = new MemoryRepository()
    const binding = createDefaultPiBinding('space-1', new Date('2026-08-27T00:00:00.000Z'))
    await repository.upsertDefinition(defaultPiDefinition)
    await repository.upsertBinding(binding)
    const service = new SpaceAgentBindingService(
      repository,
      new SpaceAgentRegistryService(repository),
    )

    await expect(service.resolveForInvocation({
      spaceInstanceId: 'space-1',
      requestedAgentId: 'pi',
      legacyDefaultAgentId: 'legacy-agent',
    })).resolves.toMatchObject({ status: 'resolved', source: 'binding' })

    await expect(service.resolveForInvocation({
      spaceInstanceId: 'space-2',
      requestedAgentId: 'pi',
      legacyDefaultAgentId: 'pi',
    })).resolves.toMatchObject({ status: 'resolved', source: 'legacy_default' })

    await expect(service.resolveForInvocation({
      spaceInstanceId: 'space-3',
    })).resolves.toMatchObject({ status: 'resolved', source: 'pi_bootstrap' })
  })

  it('does not bypass disabled or missing explicit bindings', async () => {
    const repository = new MemoryRepository()
    const disabled = {
      ...createDefaultPiBinding('space-1', new Date('2026-08-27T00:00:00.000Z')),
      status: 'disabled' as const,
    }
    await repository.upsertBinding(disabled)
    const service = new SpaceAgentBindingService(
      repository,
      new SpaceAgentRegistryService(repository),
    )

    await expect(service.resolveForInvocation({
      spaceInstanceId: 'space-1',
      requestedAgentId: 'pi',
      legacyDefaultAgentId: 'pi',
    })).resolves.toEqual({
      status: 'denied',
      reason: 'binding_disabled',
      agentId: 'pi',
    })

    await expect(service.resolveForInvocation({
      spaceInstanceId: 'space-2',
      requestedAgentId: 'other-agent',
      legacyDefaultAgentId: 'pi',
    })).resolves.toEqual({
      status: 'denied',
      reason: 'agent_not_bound',
      agentId: 'other-agent',
    })
  })

  it('reuses compatible sessions and increments generation after a closed session', async () => {
    const repository = new MemoryRepository()
    const service = new SpaceAgentSessionService(
      repository,
      (() => {
        let next = 0
        return () => `session-${++next}`
      })(),
    )
    const first = await service.getOrCreate({
      spaceInstanceId: 'space-1',
      definition: defaultPiDefinition,
      region: 'local',
      now: new Date('2026-08-27T00:00:00.000Z'),
    })
    const reused = await service.getOrCreate({
      spaceInstanceId: 'space-1',
      definition: defaultPiDefinition,
      region: 'local',
    })
    expect(reused).toBe(first)

    repository.sessions[0] = { ...first, restoreStatus: 'closed' }
    const rebuilt = await service.getOrCreate({
      spaceInstanceId: 'space-1',
      definition: defaultPiDefinition,
      region: 'local',
      now: new Date('2026-08-27T01:00:00.000Z'),
    })
    expect(rebuilt).toMatchObject({ sessionId: 'session-2', generation: 2 })
  })
})
