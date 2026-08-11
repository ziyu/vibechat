import { createFileRoute } from '@tanstack/react-router'
import { productApiErrorSchema, sessionBootstrapSchema } from '@libs/chat'
import { createDefaultIdentityService } from '@libs/identity'
import { withCfDb } from '@/lib/with-request-db'

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') || globalThis.crypto.randomUUID()
}

function productError(
  request: Request,
  status: number,
  code: string,
  message: string,
  requestId = getRequestId(request),
) {
  const body = productApiErrorSchema.parse({
    error: {
      code,
      message,
      details: {},
      requestId,
    },
  })

  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-request-id': requestId,
    },
  })
}

export const Route = createFileRoute('/v1/session/bootstrap')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = getRequestId(request)

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
              requestId,
            )
          }

          const identity = await createDefaultIdentityService().bootstrapSession(
            {
              userId: session.user.id,
              email: session.user.email,
              displayName: session.user.name || null,
              avatarUrl: session.user.image || null,
            },
            session.session.id,
          )

          const body = sessionBootstrapSchema.parse({
            contractVersion: 1,
            user: {
              id: identity.profile.userId,
              email: session.user.email,
              username: identity.profile.username,
              displayName: identity.profile.displayName,
              avatarUrl: identity.profile.avatarUrl,
            },
            matrix: identity.matrix,
          })

          return Response.json(body, {
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': requestId,
            },
          })
        } catch (error) {
          console.error('[session-bootstrap] Failed to bootstrap session', {
            requestId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          })
          return productError(
            request,
            500,
            'SESSION_BOOTSTRAP_FAILED',
            'The session could not be bootstrapped.',
            requestId,
          )
        }
      }),
    },
  },
})
