import { describe, expect, it, vi } from 'vitest'
import { SpaceInstanceServer } from '../../../apps/space-runtime/src/space-instance-server'
import { createMemoryDurableSpaceControl } from './memory-durable-space-control'

describe('SpaceInstanceServer', () => {
  it('deduplicates Matrix events and keeps source files out of public snapshots', async () => {
    const onTurnAvailable = vi.fn()
    const server = new SpaceInstanceServer(createMemoryDurableSpaceControl(), onTurnAvailable)
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
    const server = new SpaceInstanceServer(createMemoryDurableSpaceControl())
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

  it('keeps the latest four Agent activities in chronological order', async () => {
    const server = new SpaceInstanceServer(createMemoryDurableSpaceControl())
    const turn = await server.beginTurn('space-instance-activities', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '@pi update the app',
      externalRequestId: '$matrix-agent-activities',
      agentId: 'pi',
    })
    await server.claimTurn('space-instance-activities')

    for (const toolCallId of ['tool-1', 'tool-2', 'tool-3', 'tool-4', 'tool-5']) {
      await server.progress('space-instance-activities', turn.turnId, {
        type: 'activity',
        toolCallId,
        label: `Run ${toolCallId}`,
        status: 'in_progress',
      })
    }
    await server.progress('space-instance-activities', turn.turnId, {
      type: 'activity',
      toolCallId: 'tool-3',
      label: 'Run tool-3',
      status: 'completed',
    })

    const snapshot = await server.snapshot('space-instance-activities')
    expect(snapshot.build?.activities).toEqual([
      expect.objectContaining({ toolCallId: 'tool-2', status: 'in_progress' }),
      expect.objectContaining({ toolCallId: 'tool-3', status: 'completed' }),
      expect.objectContaining({ toolCallId: 'tool-4', status: 'in_progress' }),
      expect.objectContaining({ toolCallId: 'tool-5', status: 'in_progress' }),
    ])
  })

  it('deduplicates Kernel recovery and claims it as an exclusive ordered turn', async () => {
    const server = new SpaceInstanceServer(createMemoryDurableSpaceControl())
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

  it('persists fixed Template recovery metadata in the existing ordered Turn queue', async () => {
    const server = new SpaceInstanceServer(createMemoryDurableSpaceControl())
    const request = {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '应用 Space Template',
      kind: 'restore',
      externalRequestId: 'apply-template-request-1',
      agentId: 'kernel',
      recovery: {
        target: 'template',
        expectedReadyRevisionId: '0123456789abcdef',
        templateId: 'space-campfire',
        templateVersionId: 'tplv-space-campfire-0-1-2',
      },
    } as const
    const accepted = await server.beginTurn('space-instance-template', request)
    const duplicate = await server.beginTurn('space-instance-template', request)

    expect(duplicate).toMatchObject({ turnId: accepted.turnId, deduplicated: true })
    await expect(server.claimTurn('space-instance-template')).resolves.toMatchObject({
      turnId: accepted.turnId,
      kind: 'restore',
      requests: [{
        recovery: {
          target: 'template',
          expectedReadyRevisionId: '0123456789abcdef',
          templateId: 'space-campfire',
          templateVersionId: 'tplv-space-campfire-0-1-2',
        },
      }],
    })
  })

  it('treats natural-language publish requests as ordinary Agent messages', async () => {
    const server = new SpaceInstanceServer(createMemoryDurableSpaceControl())
    const accepted = await server.beginTurn('space-instance-natural-publish', {
      clientId: 'member-1',
      authorName: 'Member One',
      text: '请发布当前版本',
      externalRequestId: '$matrix-natural-publish',
      agentId: 'pi',
    })
    const claimed = await server.claimTurn('space-instance-natural-publish')
    expect(claimed).toMatchObject({
      turnId: accepted.turnId,
      kind: 'message',
    })
    expect(claimed?.requests[0]).not.toHaveProperty('publication')
  })
})
