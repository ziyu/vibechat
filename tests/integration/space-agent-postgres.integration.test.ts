import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createDefaultPiBinding,
  defaultClaudeDefinition,
  defaultPiDefinition,
} from '../../libs/space-agents/bootstrap'

const databaseUrl = process.env.SPACE_AGENTS_TEST_DATABASE_URL
const describePostgres = databaseUrl ? describe : describe.skip
let database: typeof import('@libs/database')
let repository: import('../../libs/space-agents/database-repository').DatabaseSpaceAgentRepository

describePostgres('DatabaseSpaceAgentRepository on PostgreSQL', () => {
  beforeAll(async () => {
    process.env.DB_DIALECT = 'pg'
    process.env.DATABASE_URL = databaseUrl
    vi.resetModules()
    database = await import('@libs/database')
    const { DatabaseSpaceAgentRepository } = await import(
      '../../libs/space-agents/database-repository'
    )
    repository = new DatabaseSpaceAgentRepository()
  })

  afterAll(async () => {
    if (database) {
      await database.db.delete(database.spaceAgentAuditEvent)
        .where(eq(database.spaceAgentAuditEvent.spaceInstanceId, 'space-pg-contract'))
      await database.db.delete(database.spaceAgentSession)
        .where(and(
          eq(database.spaceAgentSession.spaceInstanceId, 'space-pg-contract'),
          eq(database.spaceAgentSession.agentId, 'pi'),
        ))
      await database.db.delete(database.spaceAgentBinding)
        .where(eq(database.spaceAgentBinding.spaceInstanceId, 'space-pg-contract'))
      await database.pool?.end?.()
    }
    delete process.env.DB_DIALECT
    delete process.env.DATABASE_URL
  })

  it('persists the same Definition, binding, session, and audit contract as SQLite/D1', async () => {
    await repository.upsertDefinition(defaultPiDefinition)
    await repository.upsertDefinition(defaultClaudeDefinition)
    await expect(repository.findDefinition(defaultPiDefinition.definitionId))
      .resolves.toEqual(defaultPiDefinition)

    const binding = createDefaultPiBinding(
      'space-pg-contract',
      new Date('2026-08-27T04:00:00.000Z'),
    )
    await repository.upsertDefaultBinding(binding)
    const claudeBinding = {
      ...binding,
      bindingId: 'space-agent-binding:space-pg-contract:claude',
      agentId: 'claude',
      definitionId: defaultClaudeDefinition.definitionId,
      definitionVersion: defaultClaudeDefinition.version,
      policySnapshotHash: `sha256:${'b'.repeat(64)}`,
      updatedAt: '2026-08-27T04:01:00.000Z',
    }
    await repository.upsertDefaultBinding(claudeBinding)
    await expect(repository.findDefaultBinding('space-pg-contract'))
      .resolves.toEqual(claudeBinding)
    await expect(repository.listBindings('space-pg-contract')).resolves.toEqual([
      claudeBinding,
      { ...binding, isDefault: false, updatedAt: claudeBinding.updatedAt },
    ])

    await repository.saveSession({
      schemaVersion: 'vibechat.agent-session-ref/v1',
      sessionId: 'session-pg-contract-1',
      spaceInstanceId: 'space-pg-contract',
      agentId: 'pi',
      definitionId: defaultPiDefinition.definitionId,
      definitionVersion: defaultPiDefinition.version,
      adapterKey: defaultPiDefinition.adapterKey,
      adapterVersion: defaultPiDefinition.adapterVersion,
      generation: 1,
      providerSessionRef: null,
      summaryRef: null,
      summaryHash: null,
      region: 'local',
      restoreStatus: 'ready',
      lastTurnId: null,
      createdAt: '2026-08-27T04:00:00.000Z',
      updatedAt: '2026-08-27T04:00:00.000Z',
    })
    await expect(repository.findLatestSession('space-pg-contract', 'pi'))
      .resolves.toMatchObject({ sessionId: 'session-pg-contract-1', generation: 1 })

    await repository.appendAuditEvent({
      eventId: 'audit-pg-contract-1',
      spaceInstanceId: 'space-pg-contract',
      agentId: 'pi',
      definitionId: defaultPiDefinition.definitionId,
      sessionId: 'session-pg-contract-1',
      turnId: null,
      eventType: 'postgres_contract_test',
      policySnapshotHash: null,
      result: { ok: true },
      createdAt: new Date('2026-08-27T04:00:00.000Z'),
    })
    const auditRows = await database.db.select().from(database.spaceAgentAuditEvent)
      .where(eq(database.spaceAgentAuditEvent.eventId, 'audit-pg-contract-1'))
    expect(auditRows).toHaveLength(1)
  })
})
