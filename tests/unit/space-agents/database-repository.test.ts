import { existsSync, readFileSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentSessionRefV1 } from '../../../packages/space-agent-contracts/src'
import {
  createDefaultPiBinding,
  defaultPiDefinition,
} from '../../../libs/space-agents/bootstrap'

const databasePath = `/tmp/vibechat-space-agents-${process.pid}-${Date.now()}.sqlite`
let repository: import('../../../libs/space-agents/database-repository').DatabaseSpaceAgentRepository
let database: typeof import('@libs/database')

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  vi.resetModules()

  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const { DatabaseSpaceAgentRepository } = await import(
    '../../../libs/space-agents/database-repository'
  )
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' })
  repository = new DatabaseSpaceAgentRepository()
})

afterAll(() => {
  database?.sqliteInstance?.close()
  removeSqliteFiles(databasePath)
  delete process.env.SQLITE_DB_PATH
  delete process.env.DB_DIALECT
})

describe('DatabaseSpaceAgentRepository on SQLite', () => {
  it('loads the Pi bootstrap and persists binding policy snapshots', async () => {
    await expect(repository.findDefinition(defaultPiDefinition.definitionId))
      .resolves.toEqual(defaultPiDefinition)

    const binding = createDefaultPiBinding(
      'space-repository-1',
      new Date('2026-08-27T01:00:00.000Z'),
    )
    await repository.upsertBinding(binding)
    await repository.upsertBinding({ ...binding, updatedAt: '2026-08-27T02:00:00.000Z' })
    await expect(repository.findDefaultBinding('space-repository-1')).resolves.toEqual({
      ...binding,
      updatedAt: '2026-08-27T02:00:00.000Z',
    })
  })

  it('persists a single Space-Agent session generation and bounded audit metadata', async () => {
    const session: AgentSessionRefV1 = {
      schemaVersion: 'vibechat.agent-session-ref/v1',
      sessionId: 'session-repository-1',
      spaceInstanceId: 'space-repository-1',
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
      createdAt: '2026-08-27T01:00:00.000Z',
      updatedAt: '2026-08-27T01:00:00.000Z',
    }
    await repository.saveSession(session)
    await repository.saveSession({
      ...session,
      providerSessionRef: 'opaque-session-ref',
      lastTurnId: 'turn-1',
      updatedAt: '2026-08-27T02:00:00.000Z',
    })
    await expect(repository.findLatestSession('space-repository-1', 'pi'))
      .resolves.toMatchObject({
        generation: 1,
        providerSessionRef: 'opaque-session-ref',
        lastTurnId: 'turn-1',
      })

    await repository.appendAuditEvent({
      eventId: 'audit-1',
      spaceInstanceId: 'space-repository-1',
      agentId: 'pi',
      definitionId: defaultPiDefinition.definitionId,
      sessionId: session.sessionId,
      turnId: 'turn-1',
      eventType: 'session_updated',
      policySnapshotHash: null,
      result: { restoreStatus: 'ready' },
      createdAt: new Date('2026-08-27T02:00:00.000Z'),
    })
    await repository.appendAuditEvent({
      eventId: 'audit-1',
      spaceInstanceId: 'space-repository-1',
      agentId: 'pi',
      definitionId: defaultPiDefinition.definitionId,
      sessionId: session.sessionId,
      turnId: 'turn-1',
      eventType: 'session_updated',
      policySnapshotHash: null,
      result: { restoreStatus: 'ready' },
      createdAt: new Date('2026-08-27T02:00:00.000Z'),
    })
    const auditRows = await database.db.select().from(database.spaceAgentAuditEvent)
    expect(auditRows).toHaveLength(1)
  })
})

describe('S2 SQLite/D1-compatible migration', () => {
  it('backfills only legacy Pi Spaces idempotently and extends the existing Turn table', () => {
    const path = `/tmp/vibechat-space-agent-migration-${process.pid}-${Date.now()}.sqlite`
    const sqlite = new Database(path)
    try {
      sqlite.exec(`
        CREATE TABLE room_index (
          matrix_room_id text PRIMARY KEY NOT NULL,
          space_instance_id text,
          default_agent_id text NOT NULL
        );
        CREATE TABLE space_runtime_turn (turn_id text PRIMARY KEY NOT NULL);
        INSERT INTO room_index VALUES
          ('!pi:localhost', 'space-pi', 'pi'),
          ('!other:localhost', 'space-other', 'other-agent');
      `)
      const migration = readFileSync(
        'libs/database/drizzle-sqlite/0014_rainy_moira_mactaggert.sql',
        'utf8',
      )
      const statements = migration.split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)
      for (const statement of statements) sqlite.exec(statement)
      for (const statement of statements.filter((value) => value.startsWith('INSERT OR IGNORE'))) {
        sqlite.exec(statement)
      }

      expect(sqlite.prepare('SELECT count(*) AS count FROM space_agent_definition').get())
        .toEqual({ count: 1 })
      expect(sqlite.prepare('SELECT space_instance_id, agent_id FROM space_agent_binding').all())
        .toEqual([{ space_instance_id: 'space-pi', agent_id: 'pi' }])
      const turnColumns = sqlite.prepare('PRAGMA table_info(space_runtime_turn)').all()
        .map((column) => (column as { name: string }).name)
      expect(turnColumns).toEqual(expect.arrayContaining([
        'agent_definition_id',
        'session_generation',
        'policy_snapshot_hash',
        'reservation_transaction_id',
        'cancel_requested_at',
      ]))
    } finally {
      sqlite.close()
      removeSqliteFiles(path)
    }
  })
})

function removeSqliteFiles(path: string) {
  for (const suffix of ['', '-shm', '-wal']) {
    const candidate = `${path}${suffix}`
    if (existsSync(candidate)) rmSync(candidate, { force: true })
  }
}
