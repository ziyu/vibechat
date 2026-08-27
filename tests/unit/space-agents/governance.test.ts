import { describe, expect, it } from 'vitest'
import type {
  AgentDefinitionSnapshot,
  SpaceAgentBindingSnapshot,
} from '../../../packages/space-agent-contracts/src'
import type { SpaceAgentAuditEvent } from '../../../libs/space-agents/audit/service'
import {
  SpaceAgentGovernanceService,
  type CreateAgentDefinitionVersionInput,
  type SpaceAgentGovernanceRepository,
} from '../../../libs/space-agents/governance/service'
import {
  defaultClaudeDefinition,
  defaultPiDefinition,
} from '../../../libs/space-agents/bootstrap'

class MemoryGovernanceRepository implements SpaceAgentGovernanceRepository {
  definitions = new Map<string, AgentDefinitionSnapshot>()
  bindings = new Map<string, SpaceAgentBindingSnapshot>()
  audit: SpaceAgentAuditEvent[] = []

  async findDefinition(definitionId: string) {
    return this.definitions.get(definitionId) ?? null
  }

  async findActiveDefinitionByAgentId(agentId: string) {
    return [...this.definitions.values()].find((definition) => (
      definition.agentId === agentId && definition.status === 'active'
    )) ?? null
  }

  async findDefinitionByAgentVersion(agentId: string, version: string) {
    return [...this.definitions.values()].find((definition) => (
      definition.agentId === agentId && definition.version === version
    )) ?? null
  }

  async listDefinitions() {
    return [...this.definitions.values()]
  }

  async upsertDefinition(definition: AgentDefinitionSnapshot) {
    if (![...this.definitions.values()].some((candidate) => (
      candidate.agentId === definition.agentId
      && candidate.version === definition.version
    ))) {
      this.definitions.set(definition.definitionId, definition)
    }
  }

  async updateDefinitionStatus(
    definitionId: string,
    status: AgentDefinitionSnapshot['status'],
    updatedAt: Date,
  ) {
    const definition = this.definitions.get(definitionId)
    if (definition) {
      this.definitions.set(definitionId, {
        ...definition,
        status,
        updatedAt: updatedAt.toISOString(),
      })
    }
  }

  async findBinding(spaceInstanceId: string, agentId: string) {
    return this.bindings.get(`${spaceInstanceId}:${agentId}`) ?? null
  }

  async findDefaultBinding(spaceInstanceId: string) {
    return [...this.bindings.values()].find((binding) => (
      binding.spaceInstanceId === spaceInstanceId && binding.isDefault
    )) ?? null
  }

  async listBindings(spaceInstanceId: string) {
    return [...this.bindings.values()].filter((binding) => (
      binding.spaceInstanceId === spaceInstanceId
    ))
  }

  async listAllBindings() {
    return [...this.bindings.values()]
  }

  async upsertBinding(binding: SpaceAgentBindingSnapshot) {
    this.bindings.set(`${binding.spaceInstanceId}:${binding.agentId}`, binding)
  }

  async upsertDefaultBinding(binding: SpaceAgentBindingSnapshot) {
    if (binding.isDefault) {
      for (const [key, candidate] of this.bindings) {
        if (
          candidate.spaceInstanceId === binding.spaceInstanceId
          && candidate.agentId !== binding.agentId
        ) {
          this.bindings.set(key, { ...candidate, isDefault: false })
        }
      }
    }
    await this.upsertBinding(binding)
  }

  async appendAuditEvent(event: SpaceAgentAuditEvent) {
    if (!this.audit.some((candidate) => candidate.eventId === event.eventId)) {
      this.audit.push(event)
    }
  }

  async listAuditEvents(input: {
    spaceInstanceId?: string
    agentId?: string
    limit: number
  }) {
    return this.audit
      .filter((event) => !input.spaceInstanceId
        || event.spaceInstanceId === input.spaceInstanceId)
      .filter((event) => !input.agentId || event.agentId === input.agentId)
      .slice(-input.limit)
      .reverse()
  }
}

describe('SpaceAgentGovernanceService', () => {
  it('creates only newer immutable semantic versions, including stable after prerelease', async () => {
    const { repository, service } = fixture()
    await repository.upsertDefinition(defaultClaudeDefinition)

    const prerelease = await service.createDefinitionVersion(
      definitionInput({ version: '1.1.0-alpha.1' }),
      'admin-1',
    )
    const stable = await service.createDefinitionVersion(
      definitionInput({ version: '1.1.0' }),
      'admin-1',
    )

    expect(prerelease.definitionId).toBe('agent-definition:claude:1.1.0-alpha.1')
    expect(stable.definitionId).toBe('agent-definition:claude:1.1.0')
    await expect(service.createDefinitionVersion(
      definitionInput({ version: '1.1.0' }),
      'admin-1',
    )).rejects.toMatchObject({ code: 'AGENT_DEFINITION_VERSION_EXISTS' })
    await expect(service.createDefinitionVersion(
      definitionInput({ version: '1.0.1' }),
      'admin-1',
    )).rejects.toMatchObject({ code: 'AGENT_DEFINITION_VERSION_NOT_NEWER' })
    expect(repository.audit.map((event) => event.eventType)).toEqual([
      'admin.agent_definition.created',
      'admin.agent_definition.created',
    ])
    expect(JSON.stringify(repository.audit)).not.toMatch(/credential|source/i)
  })

  it('allows only registered Adapters and deployment-approved dedicated pools', async () => {
    const { service } = fixture()
    await expect(service.createDefinitionVersion(definitionInput({
      agentId: 'unknown',
      adapterKey: 'unknown',
      version: '1.0.0',
    }), 'admin-1')).rejects.toMatchObject({ code: 'AGENT_ADAPTER_NOT_REGISTERED' })
    await expect(service.createDefinitionVersion(definitionInput({
      agentId: 'dedicated-denied',
      version: '1.0.0',
      executionPoolPolicy: { mode: 'dedicated', poolClass: 'tenant-denied' },
    }), 'admin-1')).rejects.toMatchObject({ code: 'AGENT_DEDICATED_POOL_NOT_ALLOWED' })

    await expect(service.createDefinitionVersion(definitionInput({
      agentId: 'dedicated-approved',
      version: '1.0.0',
      executionPoolPolicy: { mode: 'dedicated', poolClass: 'tenant-approved' },
    }), 'admin-1')).resolves.toMatchObject({
      executionPoolPolicy: { mode: 'dedicated', poolClass: 'tenant-approved' },
    })
  })

  it('freezes Definitions and rejects new active bindings to frozen versions', async () => {
    const { repository, service } = fixture()
    await repository.upsertDefinition(defaultClaudeDefinition)
    const frozen = await service.setDefinitionFrozen({
      definitionId: defaultClaudeDefinition.definitionId,
      frozen: true,
      actorUserId: 'admin-1',
    })

    expect(frozen.status).toBe('frozen')
    await expect(service.upsertBinding(bindingInput({
      agentId: 'claude',
      definitionId: defaultClaudeDefinition.definitionId,
    }), 'admin-1')).rejects.toMatchObject({ code: 'AGENT_DEFINITION_NOT_ACTIVE' })
    await expect(service.upsertBinding(bindingInput({
      agentId: 'claude',
      definitionId: defaultClaudeDefinition.definitionId,
      status: 'disabled',
      isDefault: false,
    }), 'admin-1')).resolves.toMatchObject({ status: 'disabled' })
  })

  it('switches one Space default atomically while pinning version and policy hash', async () => {
    const { repository, service } = fixture()
    await repository.upsertDefinition(defaultPiDefinition)
    await repository.upsertDefinition(defaultClaudeDefinition)

    const pi = await service.upsertBinding(bindingInput({
      agentId: 'pi',
      definitionId: defaultPiDefinition.definitionId,
    }), 'admin-1')
    const claude = await service.upsertBinding(bindingInput({
      agentId: 'claude',
      definitionId: defaultClaudeDefinition.definitionId,
    }), 'admin-1')
    const bindings = await repository.listBindings('space-governed')

    expect(bindings.filter((binding) => binding.isDefault)).toEqual([claude])
    expect(repository.bindings.get('space-governed:pi')).toMatchObject({
      bindingId: pi.bindingId,
      isDefault: false,
    })
    expect(claude).toMatchObject({
      definitionVersion: defaultClaudeDefinition.version,
      policySnapshotHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    })
    expect((await service.snapshot({
      spaceInstanceId: 'space-governed',
      agentId: 'claude',
      auditLimit: 1,
    })).audit).toHaveLength(1)
  })
})

function fixture() {
  const repository = new MemoryGovernanceRepository()
  let nextEvent = 0
  const service = new SpaceAgentGovernanceService(repository, {
    allowedAdapterKeys: new Set(['pi', 'claude-code']),
    allowedDedicatedPoolClasses: new Set(['tenant-approved']),
    now: () => new Date('2026-08-27T10:00:00.000Z'),
    createEventId: () => `governance-event-${++nextEvent}`,
  })
  return { repository, service }
}

function definitionInput(
  overrides: Partial<CreateAgentDefinitionVersionInput> = {},
): CreateAgentDefinitionVersionInput {
  return {
    agentId: 'claude',
    version: '1.1.0',
    adapterKey: 'claude-code',
    adapterVersion: '0.2.7',
    provider: 'anthropic',
    model: 'configured',
    capabilities: ['conversation', 'project_patch'],
    toolPolicyId: 'space-agent-tools-default',
    pricingPolicyId: 'space-agent-pricing-default',
    maxBudgetCredits: 1_000,
    maxConcurrency: 1,
    dataRegionPolicy: { mode: 'any', regions: [] },
    executionPoolPolicy: { mode: 'regional_shared', poolClass: null },
    displayName: 'Claude Code',
    description: 'Governed Claude Code Definition',
    availability: 'available',
    ...overrides,
  }
}

function bindingInput(overrides: Partial<Parameters<
  SpaceAgentGovernanceService['upsertBinding']
>[0]> = {}) {
  return {
    spaceInstanceId: 'space-governed',
    agentId: 'pi',
    definitionId: defaultPiDefinition.definitionId,
    isDefault: true,
    permissionPolicyId: 'space-agent-permissions-default',
    toolPolicyId: 'space-agent-tools-default',
    budgetPolicy: {
      maxCreditsPerTurn: 1_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 16_000,
    },
    status: 'active' as const,
    ...overrides,
  }
}
