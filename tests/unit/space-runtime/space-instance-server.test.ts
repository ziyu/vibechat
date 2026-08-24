import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const dataDirectory = `/tmp/vibechat-space-runtime-${process.pid}-${Date.now()}`
let SpaceInstanceServer: typeof import('../../../apps/space-runtime/src/space-instance-server').SpaceInstanceServer

beforeAll(async () => {
  process.env.SPACE_RUNTIME_DATA_DIR = dataDirectory
  vi.resetModules()
  ;({ SpaceInstanceServer } = await import('../../../apps/space-runtime/src/space-instance-server'))
})

afterAll(() => {
  if (existsSync(dataDirectory)) rmSync(dataDirectory, { recursive: true, force: true })
  delete process.env.SPACE_RUNTIME_DATA_DIR
})

describe('SpaceInstanceServer', () => {
  it('deduplicates Matrix events and keeps source files out of public snapshots', async () => {
    const onTurnAvailable = vi.fn()
    const server = new SpaceInstanceServer(onTurnAvailable)
    const first = await server.beginTurn('space-instance-1', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '@pi build a scoreboard',
      externalRequestId: '$matrix-event-1',
      agentId: 'pi',
    })
    const duplicate = await server.beginTurn('space-instance-1', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '@pi build a scoreboard',
      externalRequestId: '$matrix-event-1',
      agentId: 'pi',
    })

    expect(duplicate).toMatchObject({ turnId: first.turnId, deduplicated: true })
    expect(onTurnAvailable).toHaveBeenCalledTimes(1)

    const claimed = await server.claimTurn('space-instance-1')
    expect(claimed?.requests).toHaveLength(1)
    await server.progress('space-instance-1', first.turnId, {
      type: 'workspace',
      files: {
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/index.ts': 'export default {}',
      },
      changedPath: 'src/index.ts',
    })

    const active = await server.snapshot('space-instance-1')
    expect(active.build).not.toHaveProperty('draftFiles')
    await server.completeChat('space-instance-1', first.turnId, 'Done')
    const completed = await server.snapshot('space-instance-1')
    expect(completed.messages.map((message) => message.type)).toEqual(['user', 'agent'])
    expect(completed.queue).toEqual({ activeCount: 0, pendingCount: 0 })
  })

  it('persists shared App state independently from the Matrix chat timeline', async () => {
    const server = new SpaceInstanceServer()
    await server.setAppState('space-instance-state', 'score', 4)
    await server.updateAppPresence(
      'space-instance-state',
      { clientId: 'member-1', name: 'Member One' },
      { cursor: { x: 20, y: 30 } },
    )

    const snapshot = await server.snapshot('space-instance-state')
    expect(snapshot.app).toMatchObject({
      revision: 1,
      state: { score: 4 },
    })
    expect(snapshot.app.presence).toHaveLength(1)
  })

  it('deduplicates Kernel recovery and claims it as an exclusive ordered turn', async () => {
    const server = new SpaceInstanceServer()
    const recovery = await server.beginTurn('space-instance-recovery', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '恢复默认 Chat App',
      kind: 'restore',
      externalRequestId: 'restore-request-1',
      agentId: 'kernel',
      recovery: {
        target: 'default-chat',
        expectedReadyRevisionId: '0123456789abcdef',
      },
    })
    const duplicate = await server.beginTurn('space-instance-recovery', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '恢复默认 Chat App',
      kind: 'restore',
      externalRequestId: 'restore-request-1',
      agentId: 'kernel',
      recovery: {
        target: 'default-chat',
        expectedReadyRevisionId: '0123456789abcdef',
      },
    })
    await server.beginTurn('space-instance-recovery', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '@pi add a scoreboard',
      externalRequestId: '$matrix-event-after-recovery',
      agentId: 'pi',
    })

    expect(duplicate).toMatchObject({ turnId: recovery.turnId, deduplicated: true })
    const claimed = await server.claimTurn('space-instance-recovery')
    expect(claimed).toMatchObject({
      kind: 'restore',
      requests: [{
        recovery: {
          target: 'default-chat',
          expectedReadyRevisionId: '0123456789abcdef',
        },
      }],
    })
    expect(claimed?.requests).toHaveLength(1)
    await server.completeChat('space-instance-recovery', recovery.turnId, 'Restored')
    await expect(server.claimTurn('space-instance-recovery')).resolves.toMatchObject({
      kind: 'message',
    })
  })
})
