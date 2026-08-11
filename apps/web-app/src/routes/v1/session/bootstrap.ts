import { createFileRoute } from '@tanstack/react-router'
import { productApiErrorSchema, sessionBootstrapSchema } from '@libs/chat'
import { withCfDb } from '@/lib/with-request-db'

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') || globalThis.crypto.randomUUID()
}

function productError(
  request: Request,
  status: number,
  code: string,
  message: string,
) {
  const body = productApiErrorSchema.parse({
    error: {
      code,
      message,
      details: {},
      requestId: getRequestId(request),
    },
  })

  return Response.json(body, { status })
}

export const Route = createFileRoute('/v1/session/bootstrap')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        try {
          const { auth } = await import('@libs/auth')
          const session = await auth.api.getSession({
            headers: new Headers(request.headers),
          })

          if (!session?.user?.id) {
            return productError(
              request,
              401,
              'AUTH_SESSION_REQUIRED',
              'An authenticated session is required.',
            )
          }

          const body = sessionBootstrapSchema.parse({
            contractVersion: 1,
            user: {
              id: session.user.id,
              email: session.user.email,
              displayName:
                session.user.name || session.user.email.split('@')[0] || '',
              avatarUrl: session.user.image || null,
            },
            matrix: {
              status: 'unavailable',
              reason: 'SYNAPSE_NOT_CONFIGURED',
            },
          })

          return Response.json(body, {
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': getRequestId(request),
            },
          })
        } catch (error) {
          console.error('[session-bootstrap] Failed to bootstrap session:', error)
          return productError(
            request,
            500,
            'SESSION_BOOTSTRAP_FAILED',
            'The session could not be bootstrapped.',
          )
        }
      }),
    },
  },
})
