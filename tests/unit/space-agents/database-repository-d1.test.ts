import { existsSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createDefaultPiBinding,
  defaultPiDefinition,
} from '../../../libs/space-agents/bootstrap'

const databasePath = `/tmp/vibechat-space-agents-d1-${process.pid}-${Date.now()}.sqlite`
let sqlite: Database.Database
let repository: import('../../../libs/space-agents/database-repository').DatabaseSpaceAgentRepository
let withD1: NonNullable<typeof import('@libs/database').withD1>
let binding: BetterSqliteD1Binding

beforeAll(async () => {
  sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite), { migrationsFolder: 'libs/database/drizzle-sqlite' })
  binding = new BetterSqliteD1Binding(sqlite)

  process.env.DB_DIALECT = 'd1'
  vi.resetModules()
  const database = await import('@libs/database')
  const { DatabaseSpaceAgentRepository } = await import(
    '../../../libs/space-agents/database-repository'
  )
  if (!database.withD1) throw new Error('D1 request context is unavailable')
  withD1 = database.withD1
  repository = new DatabaseSpaceAgentRepository()
})

afterAll(() => {
  sqlite?.close()
  removeSqliteFiles(databasePath)
  delete process.env.DB_DIALECT
})

describe('DatabaseSpaceAgentRepository on a D1 request binding', () => {
  it('uses the D1 proxy for Definition, binding, session, and audit operations', async () => {
    await withD1(binding, async () => {
      await expect(repository.findDefinition(defaultPiDefinition.definitionId))
        .resolves.toEqual(defaultPiDefinition)

      const bindingSnapshot = createDefaultPiBinding(
        'space-d1-1',
        new Date('2026-08-27T03:00:00.000Z'),
      )
      await repository.upsertBinding(bindingSnapshot)
      await expect(repository.findBinding('space-d1-1', 'pi')).resolves.toEqual(bindingSnapshot)
      await expect(repository.listBindings('space-d1-1')).resolves.toEqual([bindingSnapshot])

      await repository.saveSession({
        schemaVersion: 'vibechat.agent-session-ref/v1',
        sessionId: 'session-d1-1',
        spaceInstanceId: 'space-d1-1',
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
        createdAt: '2026-08-27T03:00:00.000Z',
        updatedAt: '2026-08-27T03:00:00.000Z',
      })
      await expect(repository.findLatestSession('space-d1-1', 'pi'))
        .resolves.toMatchObject({ sessionId: 'session-d1-1', generation: 1 })

      await repository.appendAuditEvent({
        eventId: 'audit-d1-1',
        spaceInstanceId: 'space-d1-1',
        agentId: 'pi',
        definitionId: defaultPiDefinition.definitionId,
        sessionId: 'session-d1-1',
        turnId: null,
        eventType: 'd1_contract_test',
        policySnapshotHash: null,
        result: { ok: true },
        createdAt: new Date('2026-08-27T03:00:00.000Z'),
      })
    })
    expect(sqlite.prepare('SELECT count(*) AS count FROM space_agent_audit_event').get())
      .toEqual({ count: 1 })
  })
})

class BetterSqliteD1Binding {
  constructor(private readonly database: Database.Database) {}

  prepare(query: string) {
    return new BetterSqliteD1Statement(this.database, query)
  }
}

class BetterSqliteD1Statement {
  private parameters: unknown[] = []

  constructor(
    private readonly database: Database.Database,
    private readonly query: string,
  ) {}

  bind(...parameters: unknown[]) {
    const statement = new BetterSqliteD1Statement(this.database, this.query)
    statement.parameters = parameters
    return statement
  }

  async all() {
    const results = this.database.prepare(this.query).all(...this.parameters)
    return { success: true, results, meta: {} }
  }

  async raw() {
    return this.database.prepare(this.query).raw(true).all(...this.parameters)
  }

  async run() {
    const result = this.database.prepare(this.query).run(...this.parameters)
    return {
      success: true,
      results: [],
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
    }
  }
}

function removeSqliteFiles(path: string) {
  for (const suffix of ['', '-shm', '-wal']) {
    const candidate = `${path}${suffix}`
    if (existsSync(candidate)) rmSync(candidate, { force: true })
  }
}
