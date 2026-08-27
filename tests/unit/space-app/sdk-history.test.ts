import { afterEach, describe, expect, it, vi } from 'vitest'

describe('Space App SDK Chat history', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('merges pages by event ID and preserves the timeline when a page fails', async () => {
    let onMessage: ((event: { source: unknown; data: Record<string, unknown> }) => void) | undefined
    let recentCalls = 0
    const parent = {
      postMessage: vi.fn((message: Record<string, unknown>) => {
        if (message.type !== 'space:command') return
        queueMicrotask(() => {
          if (message.action !== 'chat.recent') return
          recentCalls += 1
          const failed = recentCalls === 3
          onMessage?.({
            source: parent,
            data: failed ? {
              type: 'space:result',
              id: message.id,
              ok: false,
              error: 'history unavailable',
            } : {
              type: 'space:result',
              id: message.id,
              ok: true,
              result: {
                messages: [
                  { id: '$old', createdAt: '2026-08-28T00:00:00.000Z', text: 'old' },
                  { id: '$current', createdAt: '2026-08-28T00:01:00.000Z', text: 'current' },
                ],
                nextBefore: null,
                hasMore: false,
              },
            },
          })
        })
      }),
    }
    vi.stubGlobal('window', {
      parent,
      addEventListener: (_type: string, handler: typeof onMessage) => {
        onMessage = handler
      },
    })

    const { space } = await import('../../../packages/space-app-sdk/src/browser.js')
    onMessage?.({
      source: parent,
      data: {
        type: 'space:init',
        version: 1,
        snapshot: {
          appId: 'space-1',
          chat: {
            messages: [
              { id: '$current', createdAt: '2026-08-28T00:01:00.000Z', text: 'current' },
              { id: '$latest', createdAt: '2026-08-28T00:02:00.000Z', text: 'latest' },
            ],
            typingMemberIds: [],
          },
        },
      },
    })
    await space.ready

    const updates: string[][] = []
    const unsubscribe = space.chat.on((messages) => {
      updates.push(messages.map((message) => message.id))
    })
    await space.chat.recent({ limit: 20, before: '$current' })
    await space.chat.recent({ limit: 20, before: '$current' })
    expect(space.chat.messages.map((message) => message.id)).toEqual([
      '$old',
      '$current',
      '$latest',
    ])
    expect(updates.at(-1)).toEqual(['$old', '$current', '$latest'])

    await expect(space.chat.recent({ limit: 20, before: '$old' }))
      .rejects.toThrow('history unavailable')
    expect(space.chat.messages.map((message) => message.id)).toEqual([
      '$old',
      '$current',
      '$latest',
    ])
    unsubscribe()
  })
})
