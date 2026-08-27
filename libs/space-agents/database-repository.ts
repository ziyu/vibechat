import { and, asc, desc, eq, ne } from 'drizzle-orm'
import {
  agentDefinitionSnapshotSchema,
  agentSessionRefV1Schema,
  spaceAgentBindingSnapshotSchema,
  type AgentDefinitionSnapshot,
  type AgentSessionRefV1,
  type SpaceAgentBindingSnapshot,
} from '@vibechat/space-agent-contracts'
import {
  db,
  isD1Dialect,
  isSqliteDialect,
  runD1Batch,
  spaceAgentAuditEvent,
  spaceAgentBinding,
  spaceAgentDefinition,
  spaceAgentSession,
} from '@libs/database'
import type {
  SpaceAgentAuditEvent,
  SpaceAgentAuditRepository,
} from './audit/service'
import type { SpaceAgentBindingRepository } from './bindings/repository'
import type { SpaceAgentDefinitionRepository } from './registry/repository'
import type { SpaceAgentSessionRepository } from './sessions/repository'

export class DatabaseSpaceAgentRepository implements
  SpaceAgentDefinitionRepository,
  SpaceAgentBindingRepository,
  SpaceAgentSessionRepository,
  SpaceAgentAuditRepository {
  async findDefinition(definitionId: string) {
    const [row] = await db.select().from(spaceAgentDefinition)
      .where(eq(spaceAgentDefinition.definitionId, definitionId))
      .limit(1)
    return row ? toDefinition(row) : null
  }

  async findActiveDefinitionByAgentId(agentId: string) {
    const [row] = await db.select().from(spaceAgentDefinition)
      .where(and(
        eq(spaceAgentDefinition.agentId, agentId),
        eq(spaceAgentDefinition.status, 'active'),
      ))
      .orderBy(desc(spaceAgentDefinition.updatedAt))
      .limit(1)
    return row ? toDefinition(row) : null
  }

  async findDefinitionByAgentVersion(agentId: string, version: string) {
    const [row] = await db.select().from(spaceAgentDefinition)
      .where(and(
        eq(spaceAgentDefinition.agentId, agentId),
        eq(spaceAgentDefinition.version, version),
      ))
      .limit(1)
    return row ? toDefinition(row) : null
  }

  async listDefinitions() {
    const rows = await db.select().from(spaceAgentDefinition)
      .orderBy(asc(spaceAgentDefinition.agentId), desc(spaceAgentDefinition.createdAt))
      .limit(200)
    return rows.map(toDefinition)
  }

  async upsertDefinition(definition: AgentDefinitionSnapshot) {
    await db.insert(spaceAgentDefinition).values({
      definitionId: definition.definitionId,
      agentId: definition.agentId,
      version: definition.version,
      adapterKey: definition.adapterKey,
      adapterVersion: definition.adapterVersion,
      provider: definition.provider,
      model: definition.model,
      capabilitiesJson: definition.capabilities,
      toolPolicyId: definition.toolPolicyId,
      pricingPolicyId: definition.pricingPolicyId,
      usageSchemaVersion: definition.usageSchemaVersion,
      maxBudgetCredits: definition.maxBudgetCredits,
      maxConcurrency: definition.maxConcurrency,
      dataRegionPolicyJson: definition.dataRegionPolicy,
      executionPoolPolicyJson: definition.executionPoolPolicy,
      displayName: definition.displayName,
      description: definition.description,
      status: definition.status,
      availability: definition.availability,
      createdAt: new Date(definition.createdAt),
      updatedAt: new Date(definition.updatedAt),
    }).onConflictDoNothing()
  }

  async updateDefinitionStatus(
    definitionId: string,
    status: AgentDefinitionSnapshot['status'],
    updatedAt: Date,
  ) {
    await db.update(spaceAgentDefinition)
      .set({ status, updatedAt })
      .where(eq(spaceAgentDefinition.definitionId, definitionId))
  }

  async findBinding(spaceInstanceId: string, agentId: string) {
    const [row] = await db.select().from(spaceAgentBinding)
      .where(and(
        eq(spaceAgentBinding.spaceInstanceId, spaceInstanceId),
        eq(spaceAgentBinding.agentId, agentId),
      ))
      .limit(1)
    return row ? toBinding(row) : null
  }

  async findDefaultBinding(spaceInstanceId: string) {
    const [row] = await db.select().from(spaceAgentBinding)
      .where(and(
        eq(spaceAgentBinding.spaceInstanceId, spaceInstanceId),
        eq(spaceAgentBinding.isDefault, true),
      ))
      .orderBy(desc(spaceAgentBinding.updatedAt))
      .limit(1)
    return row ? toBinding(row) : null
  }

  async listBindings(spaceInstanceId: string) {
    const rows = await db.select().from(spaceAgentBinding)
      .where(eq(spaceAgentBinding.spaceInstanceId, spaceInstanceId))
      .orderBy(desc(spaceAgentBinding.isDefault), asc(spaceAgentBinding.agentId))
    return rows.map(toBinding)
  }

  async listAllBindings() {
    const rows = await db.select().from(spaceAgentBinding)
      .orderBy(desc(spaceAgentBinding.updatedAt), asc(spaceAgentBinding.spaceInstanceId))
      .limit(500)
    return rows.map(toBinding)
  }

  async upsertBinding(binding: SpaceAgentBindingSnapshot) {
    const values = bindingValues(binding)
    await db.insert(spaceAgentBinding).values(values).onConflictDoUpdate({
      target: [spaceAgentBinding.spaceInstanceId, spaceAgentBinding.agentId],
      set: bindingUpdateValues(values),
    })
  }

  async upsertDefaultBinding(binding: SpaceAgentBindingSnapshot) {
    if (!binding.isDefault) {
      await this.upsertBinding(binding)
      return
    }
    const updatedAt = new Date(binding.updatedAt)
    const values = bindingValues(binding)
    const clearPreviousDefault = db.update(spaceAgentBinding)
      .set({ isDefault: false, updatedAt })
      .where(and(
        eq(spaceAgentBinding.spaceInstanceId, binding.spaceInstanceId),
        ne(spaceAgentBinding.agentId, binding.agentId),
      ))
    const saveDefault = db.insert(spaceAgentBinding).values(values)
      .onConflictDoUpdate({
        target: [spaceAgentBinding.spaceInstanceId, spaceAgentBinding.agentId],
        set: bindingUpdateValues(values),
      })

    if (isD1Dialect()) {
      await runD1Batch([clearPreviousDefault, saveDefault] as const)
      return
    }
    if (isSqliteDialect()) {
      ;(db as any).transaction((transaction: any) => {
        transaction.update(spaceAgentBinding)
          .set({ isDefault: false, updatedAt })
          .where(and(
            eq(spaceAgentBinding.spaceInstanceId, binding.spaceInstanceId),
            ne(spaceAgentBinding.agentId, binding.agentId),
          ))
          .run()
        transaction.insert(spaceAgentBinding).values(values)
          .onConflictDoUpdate({
            target: [spaceAgentBinding.spaceInstanceId, spaceAgentBinding.agentId],
            set: bindingUpdateValues(values),
          })
          .run()
      })
      return
    }
    await db.transaction(async (transaction) => {
      await transaction.update(spaceAgentBinding)
        .set({ isDefault: false, updatedAt })
        .where(and(
          eq(spaceAgentBinding.spaceInstanceId, binding.spaceInstanceId),
          ne(spaceAgentBinding.agentId, binding.agentId),
        ))
      await transaction.insert(spaceAgentBinding).values(values)
        .onConflictDoUpdate({
          target: [spaceAgentBinding.spaceInstanceId, spaceAgentBinding.agentId],
          set: bindingUpdateValues(values),
        })
    })
  }

  async findLatestSession(spaceInstanceId: string, agentId: string) {
    const [row] = await db.select().from(spaceAgentSession)
      .where(and(
        eq(spaceAgentSession.spaceInstanceId, spaceInstanceId),
        eq(spaceAgentSession.agentId, agentId),
      ))
      .orderBy(desc(spaceAgentSession.generation))
      .limit(1)
    return row ? toSession(row) : null
  }

  async findSession(sessionId: string) {
    const [row] = await db.select().from(spaceAgentSession)
      .where(eq(spaceAgentSession.sessionId, sessionId))
      .limit(1)
    return row ? toSession(row) : null
  }

  async saveSession(session: AgentSessionRefV1) {
    const values = {
      sessionId: session.sessionId,
      spaceInstanceId: session.spaceInstanceId,
      agentId: session.agentId,
      definitionId: session.definitionId,
      definitionVersion: session.definitionVersion,
      adapterKey: session.adapterKey,
      adapterVersion: session.adapterVersion,
      generation: session.generation,
      providerSessionRef: session.providerSessionRef,
      summaryRef: session.summaryRef,
      summaryHash: session.summaryHash,
      region: session.region,
      restoreStatus: session.restoreStatus,
      lastTurnId: session.lastTurnId,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    }
    await db.insert(spaceAgentSession).values(values).onConflictDoUpdate({
      target: [
        spaceAgentSession.spaceInstanceId,
        spaceAgentSession.agentId,
        spaceAgentSession.generation,
      ],
      set: {
        providerSessionRef: values.providerSessionRef,
        summaryRef: values.summaryRef,
        summaryHash: values.summaryHash,
        restoreStatus: values.restoreStatus,
        lastTurnId: values.lastTurnId,
        updatedAt: values.updatedAt,
      },
    })
  }

  async appendAuditEvent(event: SpaceAgentAuditEvent) {
    await db.insert(spaceAgentAuditEvent).values({
      eventId: event.eventId,
      spaceInstanceId: event.spaceInstanceId,
      agentId: event.agentId,
      definitionId: event.definitionId,
      sessionId: event.sessionId,
      turnId: event.turnId,
      eventType: event.eventType,
      policySnapshotHash: event.policySnapshotHash,
      resultJson: event.result,
      createdAt: event.createdAt,
    }).onConflictDoNothing()
  }

  async listAuditEvents(input: {
    spaceInstanceId?: string
    agentId?: string
    limit: number
  }) {
    const filters = [
      ...(input.spaceInstanceId
        ? [eq(spaceAgentAuditEvent.spaceInstanceId, input.spaceInstanceId)]
        : []),
      ...(input.agentId ? [eq(spaceAgentAuditEvent.agentId, input.agentId)] : []),
    ]
    const rows = await db.select().from(spaceAgentAuditEvent)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(spaceAgentAuditEvent.createdAt))
      .limit(Math.min(Math.max(input.limit, 1), 100))
    return rows.map((row) => ({
      eventId: row.eventId,
      spaceInstanceId: row.spaceInstanceId,
      agentId: row.agentId,
      definitionId: row.definitionId,
      sessionId: row.sessionId,
      turnId: row.turnId,
      eventType: row.eventType,
      policySnapshotHash: row.policySnapshotHash,
      result: row.resultJson,
      createdAt: row.createdAt,
    }))
  }
}

function bindingValues(binding: SpaceAgentBindingSnapshot) {
  return {
    bindingId: binding.bindingId,
    spaceInstanceId: binding.spaceInstanceId,
    agentId: binding.agentId,
    definitionId: binding.definitionId,
    definitionVersion: binding.definitionVersion,
    isDefault: binding.isDefault,
    permissionPolicyId: binding.permissionPolicyId,
    toolPolicyId: binding.toolPolicyId,
    budgetPolicyJson: binding.budgetPolicy,
    policySnapshotHash: binding.policySnapshotHash,
    status: binding.status,
    createdAt: new Date(binding.createdAt),
    updatedAt: new Date(binding.updatedAt),
  }
}

function bindingUpdateValues(values: ReturnType<typeof bindingValues>) {
  return {
    definitionId: values.definitionId,
    definitionVersion: values.definitionVersion,
    isDefault: values.isDefault,
    permissionPolicyId: values.permissionPolicyId,
    toolPolicyId: values.toolPolicyId,
    budgetPolicyJson: values.budgetPolicyJson,
    policySnapshotHash: values.policySnapshotHash,
    status: values.status,
    updatedAt: values.updatedAt,
  }
}

function toDefinition(
  row: typeof spaceAgentDefinition.$inferSelect,
): AgentDefinitionSnapshot {
  return agentDefinitionSnapshotSchema.parse({
    definitionId: row.definitionId,
    agentId: row.agentId,
    version: row.version,
    adapterKey: row.adapterKey,
    adapterVersion: row.adapterVersion,
    provider: row.provider,
    model: row.model,
    capabilities: row.capabilitiesJson,
    toolPolicyId: row.toolPolicyId,
    pricingPolicyId: row.pricingPolicyId,
    usageSchemaVersion: row.usageSchemaVersion,
    maxBudgetCredits: row.maxBudgetCredits,
    maxConcurrency: row.maxConcurrency,
    dataRegionPolicy: row.dataRegionPolicyJson,
    executionPoolPolicy: row.executionPoolPolicyJson,
    displayName: row.displayName,
    description: row.description,
    status: row.status,
    availability: row.availability,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}
function toBinding(
  row: typeof spaceAgentBinding.$inferSelect,
): SpaceAgentBindingSnapshot {
  return spaceAgentBindingSnapshotSchema.parse({
    bindingId: row.bindingId,
    spaceInstanceId: row.spaceInstanceId,
    agentId: row.agentId,
    definitionId: row.definitionId,
    definitionVersion: row.definitionVersion,
    isDefault: row.isDefault,
    permissionPolicyId: row.permissionPolicyId,
    toolPolicyId: row.toolPolicyId,
    budgetPolicy: row.budgetPolicyJson,
    policySnapshotHash: row.policySnapshotHash,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function toSession(row: typeof spaceAgentSession.$inferSelect): AgentSessionRefV1 {
  return agentSessionRefV1Schema.parse({
    schemaVersion: 'vibechat.agent-session-ref/v1',
    sessionId: row.sessionId,
    spaceInstanceId: row.spaceInstanceId,
    agentId: row.agentId,
    definitionId: row.definitionId,
    definitionVersion: row.definitionVersion,
    adapterKey: row.adapterKey,
    adapterVersion: row.adapterVersion,
    generation: row.generation,
    providerSessionRef: row.providerSessionRef,
    summaryRef: row.summaryRef,
    summaryHash: row.summaryHash,
    region: row.region,
    restoreStatus: row.restoreStatus,
    lastTurnId: row.lastTurnId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}
