import { createFileRoute } from '@tanstack/react-router'
import {
  productProfileSchema,
  updateProductProfileSchema,
} from '@libs/chat'
import {
  createDefaultIdentityService,
  IdentityServiceError,
  type ProductProfile,
} from '@libs/identity'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

function profileResponse(
  session: { user: { id: string; email: string } },
  profile: ProductProfile,
) {
  return productProfileSchema.parse({
    id: profile.userId,
    email: session.user.email,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    onboardingCompleted: !!profile.onboardingCompletedAt,
  })
}

export const Route = createFileRoute('/v1/profile')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        const profile = await createDefaultIdentityService().getOrCreateProfile({
          userId: auth.session.user.id,
          email: auth.session.user.email,
          displayName: auth.session.user.name || null,
          avatarUrl: auth.session.user.image || null,
        })
        return Response.json(profileResponse(auth.session, profile), {
          headers: {
            'cache-control': 'private, no-store',
            'x-request-id': requestId,
          },
        })
      }),
      PATCH: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response

        try {
          const parsed = updateProductProfileSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(
              requestId,
              400,
              'PROFILE_REQUEST_INVALID',
              'The profile request is invalid.',
              { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
            )
          }
          const service = createDefaultIdentityService()
          await service.getOrCreateProfile({
            userId: auth.session.user.id,
            email: auth.session.user.email,
            displayName: auth.session.user.name || null,
            avatarUrl: auth.session.user.image || null,
          })
          const profile = await service.updateProfile(auth.session.user.id, parsed.data)
          return Response.json(profileResponse(auth.session, profile), {
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': requestId,
            },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productApiError(
              requestId,
              400,
              'PROFILE_REQUEST_INVALID',
              'The profile request is invalid.',
            )
          }
          if (error instanceof IdentityServiceError) {
            return productApiError(
              requestId,
              error.code === 'PROFILE_NOT_FOUND' ? 404 : 409,
              error.code,
              error.code,
            )
          }
          console.error('[profile] Failed to update profile', {
            requestId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          })
          return productApiError(
            requestId,
            500,
            'PROFILE_UPDATE_FAILED',
            'The profile could not be updated.',
          )
        }
      }),
    },
  },
})
