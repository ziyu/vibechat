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

  async listBindings(spaceInstanceId: string) {
    return [...this.bindings.values()].filter((binding) => (
      binding.spaceInstanceId === spaceInstanceId
    ))
  }

  async upsertBinding(binding: SpaceAgentBindingSnapshot) {
    this.bindings.set(`${binding.spaceInstanceId}:${binding.agentId}`, binding)
  }

  async findLatestSession(spaceInstanceId: string, agentId: string) {
    return [...this.sessions].reverse().find((session) => (
      session.spaceInstanceId === spaceInstanceId && session.agentId === agentId
    )) || null
  }

  async findSession(sessionId: string) {
    return this.sessions.find((session) => session.sessionId === sessionId) || null
  }

  async saveSession(session: AgentSessionRefV1) {
    const index = this.sessions.findIndex((candidate) => (
      candidate.spaceInstanceId === session.spaceInstanceId
      && candidate.agentId === session.agentId
      && candidate.generation === session.generation
    ))
    if (index >= 0) {
      this.sessions[index] = {
        ...this.sessions[index],
        providerSessionRef: session.providerSessionRef,
        summaryRef: session.summaryRef,
        summaryHash: session.summaryHash,
        restoreStatus: session.restoreStatus,
        lastTurnId: session.lastTurnId,
        updatedAt: session.updatedAt,
      } as AgentSessionRefV1
      return
    }
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

  it('rejects a binding whose pinned Definition version is no longer resolvable', async () => {
    const repository = new MemoryRepository()
    const binding = {
      ...createDefaultPiBinding('space-version', new Date('2026-08-27T00:00:00.000Z')),
      definitionVersion: '0.9.0',
    }
    await repository.upsertDefinition(defaultPiDefinition)
    await repository.upsertBinding(binding)
    const service = new SpaceAgentBindingService(
      repository,
      new SpaceAgentRegistryService(repository),
    )

    await expect(service.resolveForInvocation({
      spaceInstanceId: 'space-version',
      requestedAgentId: 'pi',
      legacyDefaultAgentId: 'pi',
    })).resolves.toEqual({
      status: 'denied',
      reason: 'definition_unavailable',
      agentId: 'pi',
    })
  })

  it('publishes only public binding and Definition fields with binding default authority', async () => {
    const repository = new MemoryRepository()
    const binding = createDefaultPiBinding('space-public', new Date('2026-08-27T00:00:00.000Z'))
    await repository.upsertDefinition(defaultPiDefinition)
    await repository.upsertBinding(binding)
    const service = new SpaceAgentBindingService(
      repository,
      new SpaceAgentRegistryService(repository),
    )

    const snapshot = await service.getPublicSnapshot({
      spaceInstanceId: 'space-public',
      legacyDefaultAgentId: 'legacy-agent',
    })

    expect(snapshot.defaultAgentId).toBe('pi')
    expect(snapshot.agents).toEqual([{
      binding: {
        bindingId: binding.bindingId,
        spaceInstanceId: 'space-public',
        agentId: 'pi',
        definitionId: defaultPiDefinition.definitionId,
        definitionVersion: defaultPiDefinition.version,
        isDefault: true,
        status: 'active',
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
      },
      definition: {
        definitionId: defaultPiDefinition.definitionId,
        agentId: 'pi',
        version: defaultPiDefinition.version,
        capabilities: defaultPiDefinition.capabilities,
        displayName: 'Pi',
        description: defaultPiDefinition.description,
        status: 'active',
        availability: 'available',
        createdAt: defaultPiDefinition.createdAt,
        updatedAt: defaultPiDefinition.updatedAt,
      },
    }])
    expect(snapshot.agents[0]?.definition).not.toHaveProperty('provider')
    expect(snapshot.agents[0]?.binding).not.toHaveProperty('budgetPolicy')
  })

  it('keeps a Pi public projection during the legacy compatibility window', async () => {
    const service = new SpaceAgentBindingService(
      new MemoryRepository(),
      new SpaceAgentRegistryService(new MemoryRepository()),
    )

    await expect(service.getPublicSnapshot({
      spaceInstanceId: 'space-bootstrap',
      legacyDefaultAgentId: 'pi',
      now: new Date('2026-08-27T00:00:00.000Z'),
    })).resolves.toMatchObject({
      defaultAgentId: 'pi',
      agents: [{
        binding: { agentId: 'pi', isDefault: true, status: 'active' },
        definition: { agentId: 'pi', displayName: 'Pi', availability: 'available' },
      }],
    })
  })

  it('starts sessions as restoring and reuses only ready or restoring sessions', async () => {
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
    expect(first.restoreStatus).toBe('restoring')
    expect(reused).toBe(first)

    repository.sessions[0] = { ...first, restoreStatus: 'rebuild_required' }
    const rebuilt = await service.getOrCreate({
      spaceInstanceId: 'space-1',
      definition: defaultPiDefinition,
      region: 'local',
      now: new Date('2026-08-27T01:00:00.000Z'),
    })
    expect(rebuilt).toMatchObject({
      sessionId: 'session-2',
      generation: 2,
      restoreStatus: 'restoring',
    })
  })

  it('rebuilds a generation once and returns the persisted generation on retry', async () => {
    const repository = new MemoryRepository()
    const service = new SpaceAgentSessionService(
      repository,
      (() => {
        let next = 0
        return () => `session-${++next}`
      })(),
    )
    const first = await service.getOrCreate({
      spaceInstanceId: 'space-rebuild',
      definition: defaultPiDefinition,
      region: 'local',
      now: new Date('2026-08-27T00:00:00.000Z'),
    })
    repository.sessions[0] = {
      ...first,
      restoreStatus: 'rebuild_required',
    }

    const rebuilt = await service.rebuild({
      session: repository.sessions[0]!,
      now: new Date('2026-08-27T01:00:00.000Z'),
    })
    const retried = await service.rebuild({
      session: repository.sessions[0]!,
      now: new Date('2026-08-27T02:00:00.000Z'),
    })

    expect(rebuilt).toMatchObject({
      sessionId: 'session-2',
      generation: 2,
      providerSessionRef: null,
      restoreStatus: 'restoring',
    })
    expect(retried).toEqual(rebuilt)
    expect(repository.sessions).toHaveLength(2)
  })

  it('rejects a conflicting identity for the same session generation', async () => {
    const repository = new MemoryRepository()
    const service = new SpaceAgentSessionService(repository, () => 'session-next')
    const first = await service.getOrCreate({
      spaceInstanceId: 'space-conflict',
      definition: defaultPiDefinition,
      region: 'local',
      now: new Date('2026-08-27T00:00:00.000Z'),
    })

    await expect(service.rebuild({
      session: { ...first, sessionId: 'session-forged' },
    })).rejects.toThrow('Agent session generation identity conflict')
  })
})
