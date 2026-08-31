import { createHash, randomUUID } from 'node:crypto'
import {
  agentDefinitionSnapshotSchema,
  spaceAgentBindingSnapshotSchema,
  type AgentDefinitionSnapshot,
  type SpaceAgentBindingSnapshot,
} from '@vibechat/space-agent-contracts'
import type {
  SpaceAgentAuditEvent,
  SpaceAgentAuditRepository,
} from '../audit/service'
import type { SpaceAgentBindingRepository } from '../bindings/repository'
import type { SpaceAgentDefinitionRepository } from '../registry/repository'

export type SpaceAgentGovernanceRepository =
  & SpaceAgentDefinitionRepository
  & SpaceAgentBindingRepository
  & SpaceAgentAuditRepository

export interface CreateAgentDefinitionVersionInput {
  agentId: string
  version: string
  adapterKey: string
  adapterVersion: string
  provider: string
  model: string
  capabilities: string[]
  toolPolicyId: string
  pricingPolicyId: string
  maxBudgetCredits: number
  maxConcurrency: number
  dataRegionPolicy: AgentDefinitionSnapshot['dataRegionPolicy']
  executionPoolPolicy: AgentDefinitionSnapshot['executionPoolPolicy']
  displayName: string
  description: string
  availability: AgentDefinitionSnapshot['availability']
}

export interface UpsertSpaceAgentBindingInput {
  spaceInstanceId: string
  agentId: string
  definitionId: string
  isDefault: boolean
  permissionPolicyId: string
  toolPolicyId: string
  budgetPolicy: SpaceAgentBindingSnapshot['budgetPolicy']
  status: SpaceAgentBindingSnapshot['status']
}

export class SpaceAgentGovernanceService {
  constructor(
    private readonly repository: SpaceAgentGovernanceRepository,
    private readonly options: {
      allowedAdapterKeys: ReadonlySet<string>
      allowedDedicatedPoolClasses: ReadonlySet<string>
      now?: () => Date
      createEventId?: () => string
    },
  ) {}

  async snapshot(input: {
    spaceInstanceId?: string
    agentId?: string
    auditLimit?: number
  } = {}) {
    const [definitions, bindings, audit] = await Promise.all([
      this.repository.listDefinitions(),
      input.spaceInstanceId
        ? this.repository.listBindings(input.spaceInstanceId)
        : this.repository.listAllBindings(),
      this.repository.listAuditEvents({
        spaceInstanceId: input.spaceInstanceId,
        agentId: input.agentId,
        limit: input.auditLimit ?? 50,
      }),
    ])
    return { definitions, bindings, audit }
  }

  async createDefinitionVersion(
    input: CreateAgentDefinitionVersionInput,
    actorUserId: string,
  ) {
    if (!this.options.allowedAdapterKeys.has(input.adapterKey)) {
      throw new AgentGovernanceError(
        'AGENT_ADAPTER_NOT_REGISTERED',
        'The requested Agent Adapter is not registered.',
      )
    }
    this.assertExecutionPoolPolicy(input.executionPoolPolicy)
    const existing = await this.repository.findDefinitionByAgentVersion(
      input.agentId,
      input.version,
    )
    if (existing) {
      throw new AgentGovernanceError(
        'AGENT_DEFINITION_VERSION_EXISTS',
        'Agent Definition versions are immutable and this version already exists.',
      )
    }
    const definitions = await this.repository.listDefinitions()
    const latest = definitions
      .filter((definition) => definition.agentId === input.agentId)
      .sort((left, right) => compareSemanticVersions(right.version, left.version))[0]
    if (latest && compareSemanticVersions(input.version, latest.version) <= 0) {
      throw new AgentGovernanceError(
        'AGENT_DEFINITION_VERSION_NOT_NEWER',
        `The new Definition version must be newer than ${latest.version}.`,
      )
    }

    const now = (this.options.now?.() ?? new Date()).toISOString()
    const definition = agentDefinitionSnapshotSchema.parse({
      ...input,
      definitionId: `agent-definition:${input.agentId}:${input.version}`,
      usageSchemaVersion: 'vibechat.agent-usage/v1',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    await this.repository.upsertDefinition(definition)
    await this.recordGovernanceAudit({
      actorUserId,
      spaceInstanceId: 'platform',
      agentId: definition.agentId,
      definitionId: definition.definitionId,
      eventType: 'admin.agent_definition.created',
      result: {
        version: definition.version,
        adapterKey: definition.adapterKey,
        adapterVersion: definition.adapterVersion,
        dataRegionPolicy: definition.dataRegionPolicy,
        executionPoolPolicy: definition.executionPoolPolicy,
      },
    })
    return definition
  }

  async setDefinitionFrozen(input: {
    definitionId: string
    frozen: boolean
    actorUserId: string
  }) {
    const definition = await this.repository.findDefinition(input.definitionId)
    if (!definition) {
      throw new AgentGovernanceError(
        'AGENT_DEFINITION_NOT_FOUND',
        'The Agent Definition does not exist.',
      )
    }
    if (definition.status === 'retired') {
      throw new AgentGovernanceError(
        'AGENT_DEFINITION_RETIRED',
        'A retired Agent Definition cannot be unfrozen.',
      )
    }
    const status = input.frozen ? 'frozen' : 'active'
    const updatedAt = this.options.now?.() ?? new Date()
    await this.repository.updateDefinitionStatus(
      definition.definitionId,
      status,
      updatedAt,
    )
    await this.recordGovernanceAudit({
      actorUserId: input.actorUserId,
      spaceInstanceId: 'platform',
      agentId: definition.agentId,
      definitionId: definition.definitionId,
      eventType: input.frozen
        ? 'admin.agent_definition.frozen'
        : 'admin.agent_definition.unfrozen',
      result: { previousStatus: definition.status, status },
    })
    return agentDefinitionSnapshotSchema.parse({
      ...definition,
      status,
      updatedAt: updatedAt.toISOString(),
    })
  }

  async upsertBinding(
    input: UpsertSpaceAgentBindingInput,
    actorUserId: string,
  ) {
    const definition = await this.repository.findDefinition(input.definitionId)
    if (!definition || definition.agentId !== input.agentId) {
      throw new AgentGovernanceError(
        'AGENT_DEFINITION_NOT_FOUND',
        'The binding must reference a Definition for the same Agent.',
      )
    }
    if (definition.status !== 'active' && input.status === 'active') {
      throw new AgentGovernanceError(
        'AGENT_DEFINITION_NOT_ACTIVE',
        'An active binding must reference an active Agent Definition.',
      )
    }
    if (input.isDefault && input.status !== 'active') {
      throw new AgentGovernanceError(
        'AGENT_DEFAULT_BINDING_DISABLED',
        'A disabled Agent binding cannot be the Space default.',
      )
    }
    const existing = await this.repository.findBinding(
      input.spaceInstanceId,
      input.agentId,
    )
    const now = (this.options.now?.() ?? new Date()).toISOString()
    const binding = spaceAgentBindingSnapshotSchema.parse({
      ...input,
      bindingId: existing?.bindingId
        ?? `space-agent-binding:${input.spaceInstanceId}:${input.agentId}`,
      definitionVersion: definition.version,
      policySnapshotHash: policySnapshotHash(input, definition),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    await this.repository.upsertDefaultBinding(binding)
    await this.recordGovernanceAudit({
      actorUserId,
      spaceInstanceId: binding.spaceInstanceId,
      agentId: binding.agentId,
      definitionId: binding.definitionId,
      eventType: existing
        ? 'admin.space_agent_binding.updated'
        : 'admin.space_agent_binding.created',
      policySnapshotHash: binding.policySnapshotHash,
      result: {
        definitionVersion: binding.definitionVersion,
        isDefault: binding.isDefault,
        status: binding.status,
        permissionPolicyId: binding.permissionPolicyId,
        toolPolicyId: binding.toolPolicyId,
        budgetPolicy: binding.budgetPolicy,
      },
    })
    return binding
  }

  private assertExecutionPoolPolicy(
    policy: AgentDefinitionSnapshot['executionPoolPolicy'],
  ) {
    if (
      policy.mode === 'dedicated'
      && !this.options.allowedDedicatedPoolClasses.has(policy.poolClass)
    ) {
      throw new AgentGovernanceError(
        'AGENT_DEDICATED_POOL_NOT_ALLOWED',
        'The dedicated Agent pool is not in the deployment allowlist.',
      )
    }
  }

  private recordGovernanceAudit(input: {
    actorUserId: string
    spaceInstanceId: string
    agentId: string
    definitionId: string | null
    eventType: string
    policySnapshotHash?: string | null
    result: Record<string, unknown>
  }) {
    const now = this.options.now?.() ?? new Date()
    const event: SpaceAgentAuditEvent = {
      eventId: this.options.createEventId?.()
        ?? `agent-governance:${randomUUID()}`,
      spaceInstanceId: input.spaceInstanceId,
      agentId: input.agentId,
      definitionId: input.definitionId,
      sessionId: null,
      turnId: null,
      eventType: input.eventType,
      policySnapshotHash: input.policySnapshotHash ?? null,
      result: { actorUserId: input.actorUserId, ...input.result },
      createdAt: now,
    }
    const serialized = JSON.stringify(event.result)
    if (serialized.length > 4_096) {
      throw new AgentGovernanceError(
        'AGENT_AUDIT_RESULT_TOO_LARGE',
        'The governance audit record exceeds its bounded size.',
      )
    }
    return this.repository.appendAuditEvent(event)
  }
}

export class AgentGovernanceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'AgentGovernanceError'
  }
}

function policySnapshotHash(
  input: UpsertSpaceAgentBindingInput,
  definition: AgentDefinitionSnapshot,
) {
  const canonical = JSON.stringify({
    permissionPolicyId: input.permissionPolicyId,
    toolPolicyId: input.toolPolicyId,
    pricingPolicyId: definition.pricingPolicyId,
    budgetPolicy: input.budgetPolicy,
    dataRegionPolicy: definition.dataRegionPolicy,
    executionPoolPolicy: definition.executionPoolPolicy,
  })
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

function compareSemanticVersions(left: string, right: string) {
  const parse = (value: string) => {
    const separator = value.indexOf('-')
    const core = separator === -1 ? value : value.slice(0, separator)
    return {
      core: core.split('.').map((part) => Number(part)),
      prerelease: separator === -1
        ? []
        : value.slice(separator + 1).split('.'),
    }
  }
  const leftVersion = parse(left)
  const rightVersion = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftVersion.core[index] ?? 0)
      - (rightVersion.core[index] ?? 0)
    if (difference !== 0) return difference
  }
  if (leftVersion.prerelease.length === 0) {
    return rightVersion.prerelease.length === 0 ? 0 : 1
  }
  if (rightVersion.prerelease.length === 0) return -1
  const length = Math.max(
    leftVersion.prerelease.length,
    rightVersion.prerelease.length,
  )
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftVersion.prerelease[index]
    const rightIdentifier = rightVersion.prerelease[index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === rightIdentifier) continue
    const leftNumeric = /^\d+$/.test(leftIdentifier)
    const rightNumeric = /^\d+$/.test(rightIdentifier)
    if (leftNumeric && rightNumeric) {
      return Number(leftIdentifier) - Number(rightIdentifier)
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftIdentifier.localeCompare(rightIdentifier)
  }
  return 0
}
