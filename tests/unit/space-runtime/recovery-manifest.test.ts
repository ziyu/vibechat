import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { spaceRuntimeRecoveryManifestSchema } from '@vibechat/space-app-contracts'

const databasePath = `/tmp/vibechat-recovery-manifest-${process.pid}-${Date.now()}.sqlite`
const spaceInstanceId = 'space-recovery-manifest'
let database: typeof import('@libs/database')
let control: import('@libs/space-runtime-control').DatabaseSpaceRuntimeControlPlane

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  vi.resetModules()
  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const { DatabaseSpaceRuntimeControlPlane } = await import(
    '@libs/space-runtime-control'
  )
  migrate(database.db as never, {
    migrationsFolder: 'libs/database/drizzle-sqlite',
  })
  control = new DatabaseSpaceRuntimeControlPlane()
})

afterAll(() => {
  database.sqliteInstance?.close()
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`
    if (existsSync(path)) rmSync(path, { force: true })
  }
  delete process.env.SQLITE_DB_PATH
  delete process.env.DB_DIALECT
})

describe('Space Runtime recovery manifest', () => {
  it('captures bounded recovery authorities without source, App State, payload, or provider refs', async () => {
    const lease = await control.claimLease(spaceInstanceId, 'runtime-a', 30_000)
    expect(lease).toBeTruthy()
    await control.saveInstance({
      spaceInstanceId,
      sequence: 7,
      snapshot: { state: 'ready', privateAppState: 'must-not-leak' },
    }, lease!)
    await control.saveProject({
      projectId: 'project-recovery-manifest',
      spaceInstanceId,
      sourceObjectKey: `space-runtime/objects/${'a'.repeat(64)}`,
      sourceHash: `sha256:${'b'.repeat(64)}`,
      artifactObjectKey: `space-runtime/objects/${'c'.repeat(64)}`,
      artifactHash: `sha256:${'d'.repeat(64)}`,
      readyRevisionId: '1111111111111111',
      publishedRevisionId: '1111111111111111',
      releaseId: 'release-recovery-manifest',
      metadata: { format: 'vibechat.stored-project/v1' },
    }, lease!)
    await control.enqueueTurn({
      turnId: 'turn-recovery-manifest',
      spaceInstanceId,
      externalRequestId: 'matrix-recovery-manifest',
      kind: 'message',
      payload: { privateMessage: 'must-not-leak' },
    })
    await control.claimNextTurn(spaceInstanceId, lease!)
    await control.enqueueOutbox({
      eventId: 'outbox-recovery-manifest',
      spaceInstanceId,
      eventType: 'matrix_v2_state',
      dedupeKey: 'recovery-manifest',
      payload: { privatePayload: 'must-not-leak' },
    })
    await control.claimOutbox('outbox-owner')

    const agents = new (await import(
      '../../../libs/space-agents/database-repository'
    )).DatabaseSpaceAgentRepository()
    await agents.saveSession({
      schemaVersion: 'vibechat.agent-session-ref/v1',
      sessionId: 'session-recovery-manifest',
      spaceInstanceId,
      agentId: 'claude',
      definitionId: 'agent-definition-claude-v1',
      definitionVersion: '1.0.0',
      adapterKey: 'claude-code',
      adapterVersion: '0.2.7',
      generation: 1,
      providerSessionRef: 'provider-session-secret',
      summaryRef: 'summary-object-secret',
      summaryHash: `sha256:${'e'.repeat(64)}`,
      region: 'test-region',
      restoreStatus: 'ready',
      lastTurnId: 'turn-recovery-manifest',
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:01.000Z',
    })

    const { captureSpaceRuntimeRecoveryManifest } = await import(
      '@libs/space-runtime-control'
    )
    const manifest = await captureSpaceRuntimeRecoveryManifest(
      spaceInstanceId,
      new Date('2026-08-28T01:00:00.000Z'),
    )

    expect(spaceRuntimeRecoveryManifestSchema.safeParse(manifest).success).toBe(true)
    expect(manifest).toMatchObject({
      schemaVersion: 'vibechat.space-runtime-recovery-manifest/v1',
      capturedAt: '2026-08-28T01:00:00.000Z',
      spaceInstanceId,
      instance: {
        sequence: 7,
        snapshotHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        fencingToken: lease!.fencingToken,
      },
      project: {
        readyRevisionId: '1111111111111111',
        releaseId: 'release-recovery-manifest',
      },
      lease: {
        ownerId: 'runtime-a',
        fencingToken: lease!.fencingToken,
      },
      agentSessions: [{
        agentId: 'claude',
        generation: 1,
        restoreStatus: 'ready',
      }],
      turns: [{ status: 'active', count: 1, maximumAttempt: 1 }],
      outbox: [{ status: 'processing', count: 1, maximumAttempt: 1 }],
    })
    expect(manifest.revisions).toHaveLength(1)
    expect(JSON.stringify(manifest)).not.toContain('must-not-leak')
    expect(JSON.stringify(manifest)).not.toContain('provider-session-secret')
    expect(JSON.stringify(manifest)).not.toContain('summary-object-secret')
  })
})
