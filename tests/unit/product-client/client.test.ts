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
})
