import type { SpaceRuntimeSnapshot } from '@vibechat/space-app-contracts'
import { describe, expect, it } from 'vitest'
import {
  createSpaceAppBridgeGuard,
  selectReadySpaceAppTarget,
  shouldProjectRuntimeEventToApp,
  validateSpaceAppBridgeCommand,
  type ReadySpaceAppTarget,
} from '../../../apps/web-app/src/features/chat/space-runtime-state'

function snapshot(
  matrixRoomId: string,
  state: SpaceRuntimeSnapshot['devPreview']['state'],
  draftId: string | null = 'draft-ready-1',
  previewVersion = draftId ?? 'draft-candidate-1',
): SpaceRuntimeSnapshot {
  return {
    spaceInstanceId: 'space-instance-1',
    matrixRoomId,
    defaultAgentId: 'pi',
    availableAgents: [{ id: 'pi', name: 'Pi', available: true }],
    project: {
      exists: true,
      draftId,
      releaseId: null,
      updatedAt: '2026-08-24T00:00:00.000Z',
      summary: 'Ready App',
      template: null,
    },
    devPreview: state === 'ready'
      ? { state, version: previewVersion, updatedAt: '2026-08-24T00:00:00.000Z' }
      : { state, version: previewVersion },
    messages: [],
    build: null,
    queue: { activeCount: 0, pendingCount: 0 },
    appState: { revision: 0, state: {}, presence: [] },
  }
}

const previous: ReadySpaceAppTarget = {
  roomId: '!space:localhost',
  revisionId: 'draft-previous',
  url: '/v1/spaces/instances/space/app?channel=dev&version=draft-previous',
}

describe('Space Runtime ready App selection', () => {
  it('keeps Runtime-private messages out of the Matrix-backed App chat', () => {
    const current = snapshot('!space:localhost', 'ready')
    current.messages = [
      {
        id: 'user-1',
        turnId: 'turn-1',
        type: 'user',
        authorId: 'member-1',
        authorName: 'Member One',
        text: '发布当前开发版本',
        createdAt: '2026-08-24T00:00:00.000Z',
      },
      {
        id: 'agent-1',
        turnId: 'turn-1',
        type: 'agent',
        authorId: 'pi',
        authorName: 'Pi',
        text: '我已经完成界面调整。',
        createdAt: '2026-08-24T00:00:01.000Z',
      },
      {
        id: 'kernel-1',
        turnId: 'turn-2',
        type: 'agent',
        authorId: 'kernel',
        authorName: 'Kernel',
        text: '当前开发版本已正式发布。',
        createdAt: '2026-08-24T00:00:02.000Z',
      },
      {
        id: 'error-1',
        turnId: 'turn-3',
        type: 'error',
        authorId: 'system',
        authorName: 'ERROR',
        text: 'release failed',
        createdAt: '2026-08-24T00:00:03.000Z',
      },
    ]

    expect(shouldProjectRuntimeEventToApp({
      type: 'message',
      message: current.messages[1],
    })).toBe(false)
    expect(shouldProjectRuntimeEventToApp({
      type: 'message',
      message: current.messages[2],
    })).toBe(false)
    expect(shouldProjectRuntimeEventToApp({
      type: 'message',
      message: current.messages[3],
    })).toBe(false)
    expect(shouldProjectRuntimeEventToApp({
      type: 'queue_updated',
      activeCount: 1,
    })).toBe(true)
  })

  it('does not mount an App iframe before the first ready Revision', () => {
    expect(selectReadySpaceAppTarget({
      roomId: '!space:localhost',
      snapshot: snapshot('!space:localhost', 'building', null),
      previous: null,
      baseUrl: '/v1/spaces/instances/space/app?channel=dev',
    })).toBeNull()
  })

  it('mounts the exact ready Revision once Runtime preparation completes', () => {
    expect(selectReadySpaceAppTarget({
      roomId: '!space:localhost',
      snapshot: snapshot('!space:localhost', 'ready'),
      previous: null,
      baseUrl: '/v1/spaces/instances/space/app?channel=dev',
    })).toEqual({
      roomId: '!space:localhost',
      revisionId: 'draft-ready-1',
      url: '/v1/spaces/instances/space/app?channel=dev&version=draft-ready-1',
    })
  })

  it('does not mount when the ready preview belongs to another Revision', () => {
    const stale = snapshot('!space:localhost', 'ready')
    stale.devPreview.version = 'draft-stale'
    expect(selectReadySpaceAppTarget({
      roomId: '!space:localhost',
      snapshot: stale,
      previous: null,
      baseUrl: '/v1/spaces/instances/space/app?channel=dev',
    })).toBeNull()
  })

  it('keeps the last ready App while the same Space builds or reconnects', () => {
    expect(selectReadySpaceAppTarget({
      roomId: '!space:localhost',
      snapshot: snapshot('!space:localhost', 'building', 'draft-next'),
      previous,
      baseUrl: '/v1/spaces/instances/space/app?channel=dev',
    })).toBe(previous)
    expect(selectReadySpaceAppTarget({
      roomId: '!space:localhost',
      snapshot: null,
      previous,
      baseUrl: '/v1/spaces/instances/space/app?channel=dev',
    })).toBe(previous)
  })

  it('recovers the stored ready Revision after a refresh while a Candidate builds or fails', () => {
    for (const state of ['building', 'failed'] as const) {
      expect(selectReadySpaceAppTarget({
        roomId: '!space:localhost',
        snapshot: snapshot(
          '!space:localhost',
          state,
          'draft-ready-1',
          'draft-candidate-2',
        ),
        previous: null,
        baseUrl: '/v1/spaces/instances/space/app?channel=dev',
      })).toEqual({
        roomId: '!space:localhost',
        revisionId: 'draft-ready-1',
        url: '/v1/spaces/instances/space/app?channel=dev&version=draft-ready-1',
      })
    }
  })

  it('does not treat a failed first Candidate as a ready App', () => {
    expect(selectReadySpaceAppTarget({
      roomId: '!space:localhost',
      snapshot: snapshot('!space:localhost', 'failed', null),
      previous: null,
      baseUrl: '/v1/spaces/instances/space/app?channel=dev',
    })).toBeNull()
  })

  it('never carries a previous Space App or stale snapshot into another Space', () => {
    expect(selectReadySpaceAppTarget({
      roomId: '!other:localhost',
      snapshot: snapshot('!space:localhost', 'ready'),
      previous,
      baseUrl: '/v1/spaces/instances/other/app?channel=dev',
    })).toBeNull()
  })
})

describe('Space App bridge guard', () => {
  const nonce = '9cb2a6c8-0fd9-4690-991f-857e93aaf61e'
  const command = (sequence: number, overrides: Record<string, unknown> = {}) => ({
    type: 'space:command',
    version: 1,
    id: `command-${sequence}`,
    nonce,
    sequence,
    action: 'theme.set',
    payload: {},
    ...overrides,
  })

  it('requires the mounted iframe nonce and a strictly increasing sequence', () => {
    const initial = createSpaceAppBridgeGuard(nonce, 1_000)
    expect(validateSpaceAppBridgeCommand(command(1, { nonce: crypto.randomUUID() }), initial, 1_001))
      .toEqual({ ok: false, code: 'SPACE_APP_BRIDGE_NONCE_INVALID' })

    const accepted = validateSpaceAppBridgeCommand(command(1), initial, 1_002)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) throw new Error('expected command to be accepted')
    expect(validateSpaceAppBridgeCommand(command(1), accepted.guard, 1_003))
      .toEqual({ ok: false, code: 'SPACE_APP_BRIDGE_SEQUENCE_INVALID' })
  })

  it('rejects unknown actions, oversized payloads, and bursts above the bounded rate', () => {
    const initial = createSpaceAppBridgeGuard(nonce, 1_000)
    expect(validateSpaceAppBridgeCommand(command(1, { action: 'app.publish' }), initial, 1_001))
      .toEqual({ ok: false, code: 'SPACE_APP_BRIDGE_COMMAND_INVALID' })
    expect(validateSpaceAppBridgeCommand(command(1, {
      payload: { value: 'x'.repeat(64 * 1024) },
    }), initial, 1_001)).toEqual({
      ok: false,
      code: 'SPACE_APP_BRIDGE_PAYLOAD_TOO_LARGE',
    })

    let guard = initial
    for (let sequence = 1; sequence <= 120; sequence += 1) {
      const accepted = validateSpaceAppBridgeCommand(command(sequence), guard, 1_002)
      expect(accepted.ok).toBe(true)
      if (!accepted.ok) throw new Error('expected command to be accepted')
      guard = accepted.guard
    }
    expect(validateSpaceAppBridgeCommand(command(121), guard, 1_003)).toEqual({
      ok: false,
      code: 'SPACE_APP_BRIDGE_RATE_LIMITED',
    })
    expect(validateSpaceAppBridgeCommand(command(121), guard, 11_001).ok).toBe(true)
  })
})
