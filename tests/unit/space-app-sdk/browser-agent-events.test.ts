import { runInNewContext } from 'node:vm'

import { spaceAppBrowserSource } from '@vibechat/space-app-sdk/browser-source'
import { describe, expect, it, vi } from 'vitest'

interface BrowserSdkHarness {
  readonly space: {
    readonly ready: Promise<unknown>
    readonly agent: {
      id?: string
      name?: string
      build: Record<string, unknown> | null
      queue: { activeCount: number; pendingCount: number }
    }
    on(type: string, listener: (value: unknown) => void): () => void
  }
  emit(data: Record<string, unknown>): void
}

function createBrowserSdkHarness(): BrowserSdkHarness {
  const messageListeners: Array<(event: {
    source: unknown
    data: Record<string, unknown>
  }) => void> = []
  const parent = { postMessage: vi.fn() }
  const windowObject = {
    parent,
    addEventListener(type: string, listener: (event: {
      source: unknown
      data: Record<string, unknown>
    }) => void) {
      if (type === 'message') messageListeners.push(listener)
    },
  }
  const sandbox = {
    window: windowObject,
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
  } as Record<string, unknown>
  const executableSource = spaceAppBrowserSource.replace(
    'export const space =',
    'const space =',
  )
  runInNewContext(executableSource, sandbox, {
    filename: 'space-app-sdk-browser.js',
  })

  return {
    space: sandbox.spaceApp as BrowserSdkHarness['space'],
    emit(data) {
      for (const listener of messageListeners) {
        listener({ source: parent, data })
      }
    },
  }
}

function initAgentSnapshot(harness: BrowserSdkHarness) {
  harness.emit({
    type: 'space:init',
    version: 1,
    snapshot: {
      appId: 'space-real-agent',
      locale: 'zh-CN',
      mentions: [
        {
          id: 'builder-agent',
          handle: 'builder-agent',
          name: 'Builder Agent',
          type: 'agent',
          available: true,
        },
      ],
      agent: {
        id: 'default-agent',
        name: 'Default Agent',
        messages: [],
        build: null,
        queue: { activeCount: 0, pendingCount: 0 },
      },
    },
  })
}

describe('Space App SDK Agent Runtime events', () => {
  it('projects real Runtime stage, activity, identity, and queue updates to Agent consumers', async () => {
    const harness = createBrowserSdkHarness()
    initAgentSnapshot(harness)
    await harness.space.ready
    const updates: unknown[] = []
    harness.space.on('agent', (agent) => updates.push(agent))

    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'turn_started',
        turn: {
          turnId: 'turn-real-1',
          agentId: 'builder-agent',
          authorName: 'Alice',
          requestCount: 1,
          startedAt: '2026-08-28T00:00:00.000Z',
          stage: 'Builder Agent 正在理解消息',
          agentText: '',
          activities: [],
        },
      },
    })
    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'status',
        stage: 'thinking',
        message: 'Builder Agent 正在查看当前应用…',
      },
    })
    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'activity',
        toolCallId: 'tool-read-page',
        label: '读取 app/src/page.ts',
        status: 'in_progress',
        path: 'app/src/page.ts',
      },
    })
    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'activity',
        toolCallId: 'tool-read-page',
        label: '读取 app/src/page.ts',
        status: 'completed',
        path: 'app/src/page.ts',
      },
    })
    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'queue_updated',
        activeCount: 1,
        pendingCount: 2,
      },
    })

    expect(harness.space.agent).toMatchObject({
      id: 'builder-agent',
      name: 'Builder Agent',
      queue: { activeCount: 1, pendingCount: 2 },
      build: {
        turnId: 'turn-real-1',
        stage: 'Builder Agent 正在查看当前应用…',
        activities: [
          {
            toolCallId: 'tool-read-page',
            label: '读取 app/src/page.ts',
            status: 'completed',
          },
        ],
      },
    })
    expect(updates).toHaveLength(5)

    harness.emit({
      type: 'space:event',
      version: 1,
      event: { type: 'draft_ready', turnId: 'turn-real-1' },
    })
    expect(harness.space.agent.build).toBeNull()
  })

  it('ignores progress that is not attached to an active Runtime turn', async () => {
    const harness = createBrowserSdkHarness()
    initAgentSnapshot(harness)
    await harness.space.ready
    const listener = vi.fn()
    harness.space.on('agent', listener)

    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'activity',
        toolCallId: 'orphan-tool',
        label: '不应显示的活动',
        status: 'in_progress',
      },
    })

    expect(harness.space.agent.build).toBeNull()
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps the latest four activities in Runtime chronological order', async () => {
    const harness = createBrowserSdkHarness()
    initAgentSnapshot(harness)
    await harness.space.ready

    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'turn_started',
        turn: {
          turnId: 'turn-real-order',
          agentId: 'builder-agent',
          authorName: 'Alice',
          requestCount: 1,
          startedAt: '2026-08-28T00:00:00.000Z',
          stage: 'Builder Agent 正在理解消息',
          agentText: '',
          activities: [],
        },
      },
    })
    for (const toolCallId of ['tool-1', 'tool-2', 'tool-3', 'tool-4', 'tool-5']) {
      harness.emit({
        type: 'space:event',
        version: 1,
        event: {
          type: 'activity',
          toolCallId,
          label: `Run ${toolCallId}`,
          status: 'in_progress',
        },
      })
    }
    harness.emit({
      type: 'space:event',
      version: 1,
      event: {
        type: 'activity',
        toolCallId: 'tool-3',
        label: 'Run tool-3',
        status: 'completed',
      },
    })

    expect(harness.space.agent.build?.activities).toEqual([
      expect.objectContaining({ toolCallId: 'tool-2', status: 'in_progress' }),
      expect.objectContaining({ toolCallId: 'tool-3', status: 'completed' }),
      expect.objectContaining({ toolCallId: 'tool-4', status: 'in_progress' }),
      expect.objectContaining({ toolCallId: 'tool-5', status: 'in_progress' }),
    ])
  })
})
