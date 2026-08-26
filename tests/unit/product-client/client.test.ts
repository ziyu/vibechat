import { describe, expect, it, vi } from 'vitest'
import {
  ProductApiClient,
  ProductApiClientError,
  type ProductApiTransport,
} from '@vibechat/product-client'

function transport(response: Response) {
  return { fetch: vi.fn().mockResolvedValue(response) } satisfies ProductApiTransport
}

describe('ProductApiClient', () => {
  it('uses an injected origin and parses the shared session contract', async () => {
    const http = transport(Response.json({
      contractVersion: 1,
      user: {
        id: 'user-1',
        email: 'person@example.com',
        username: 'person',
        displayName: 'Person',
        avatarUrl: null,
        onboardingCompleted: true,
      },
      matrix: {
        status: 'unavailable',
        reason: 'SYNAPSE_NOT_CONFIGURED',
      },
    }))
    const client = new ProductApiClient({
      baseUrl: 'https://api.vibechat.example/',
      transport: http,
    })

    const result = await client.bootstrapSession()

    expect(result.user.id).toBe('user-1')
    expect(http.fetch).toHaveBeenCalledWith(
      new URL('https://api.vibechat.example/v1/session/bootstrap'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('preserves the backend error contract', async () => {
    const http = transport(Response.json({
      error: {
        code: 'AUTH_SESSION_REQUIRED',
        message: 'Sign in first.',
        details: {},
        requestId: 'request-1',
      },
    }, { status: 401 }))
    const client = new ProductApiClient({ transport: http })

    await expect(client.bootstrapSession()).rejects.toMatchObject({
      name: 'ProductApiClientError',
      status: 401,
      code: 'AUTH_SESSION_REQUIRED',
      requestId: 'request-1',
    } satisfies Partial<ProductApiClientError>)
  })

  it('rejects a successful response that violates the shared contract', async () => {
    const client = new ProductApiClient({
      transport: transport(Response.json({ contractVersion: 999 })),
    })

    await expect(client.bootstrapSession()).rejects.toMatchObject({ name: 'ZodError' })
  })

  it('sends Space App bridge commands through the authenticated product boundary', async () => {
    const http = transport(Response.json({ ok: true, revision: 2 }))
    const client = new ProductApiClient({ transport: http })

    await expect(client.sendSpaceAppCommand('!space:localhost', {
      action: 'state.set',
      payload: { key: 'score', value: 3 },
    })).resolves.toMatchObject({ ok: true, revision: 2 })
    expect(http.fetch).toHaveBeenCalledWith(
      '/v1/spaces/instances/!space%3Alocalhost/bridge',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })

  it('submits an exact ready Revision for Kernel Default Chat recovery', async () => {
    const http = transport(Response.json({
      accepted: true,
      deduplicated: false,
      turnId: 'restore-turn-1',
      queuePosition: 1,
    }))
    const client = new ProductApiClient({ transport: http })

    await expect(client.restoreSpaceApp('!space:localhost', {
      requestId: 'restore-request-1',
      target: 'default-chat',
      expectedReadyRevisionId: '0123456789abcdef',
    })).resolves.toMatchObject({ accepted: true, turnId: 'restore-turn-1' })
    expect(http.fetch).toHaveBeenCalledWith(
      '/v1/spaces/instances/!space%3Alocalhost/restore',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          requestId: 'restore-request-1',
          target: 'default-chat',
          expectedReadyRevisionId: '0123456789abcdef',
        }),
      }),
    )
  })

  it('submits an exact ready Revision for Kernel publish', async () => {
    const http = transport(Response.json({
      accepted: true,
      deduplicated: false,
      turnId: 'publish-turn-1',
      queuePosition: 1,
    }))
    const client = new ProductApiClient({ transport: http })

    await expect(client.publishSpaceApp('!space:localhost', {
      requestId: 'publish-request-1',
      expectedReadyRevisionId: '0123456789abcdef',
    })).resolves.toMatchObject({ accepted: true, turnId: 'publish-turn-1' })
    expect(http.fetch).toHaveBeenCalledWith(
      '/v1/spaces/instances/!space%3Alocalhost/publish',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          requestId: 'publish-request-1',
          expectedReadyRevisionId: '0123456789abcdef',
        }),
      }),
    )
  })

  it('submits a structured Agent mention with the confirmed Matrix event', async () => {
    const http = transport(Response.json({
      accepted: true,
      deduplicated: false,
      turnId: 'agent-turn-1',
      queuePosition: 1,
    }))
    const client = new ProductApiClient({ transport: http })

    await client.createSpaceAgentTurn('!space:localhost', {
      matrixEventId: '$event-1',
      message: '@pi hello',
      agentMention: { type: 'agent', id: 'pi' },
    })

    expect(http.fetch).toHaveBeenCalledWith(
      '/v1/spaces/instances/!space%3Alocalhost/turns',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          matrixEventId: '$event-1',
          message: '@pi hello',
          agentMention: { type: 'agent', id: 'pi' },
        }),
      }),
    )
  })
})
