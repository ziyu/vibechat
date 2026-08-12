import { createFileRoute } from '@tanstack/react-router'
import { productApiErrorSchema, sessionBootstrapSchema } from '@vibechat/api-contracts'
import {
  createDefaultIdentityService,
  SynapseAdapterError,
} from '@libs/identity'
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

function safeCauseCode(error: SynapseAdapterError) {
  const cause = error.cause
  if (!cause || typeof cause !== 'object') return null
  const nested = 'cause' in cause ? cause.cause : null
  if (!nested || typeof nested !== 'object' || !('code' in nested)) return null
  return typeof nested.code === 'string' ? nested.code : null
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
              onboardingCompleted: !!identity.profile.onboardingCompletedAt,
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
            ...(error instanceof SynapseAdapterError
              ? {
                  errorCode: error.code,
                  upstreamStatus: error.status,
                  matrixErrorCode: error.matrixErrorCode,
                  networkErrorCode: safeCauseCode(error),
                }
              : {}),
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
