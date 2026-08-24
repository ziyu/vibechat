import type { SpaceRuntimeSnapshot } from '@vibechat/space-app-contracts'
import { describe, expect, it } from 'vitest'
import {
  selectReadySpaceAppTarget,
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
