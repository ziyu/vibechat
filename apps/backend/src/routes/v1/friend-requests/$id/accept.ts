import { createFileRoute } from '@tanstack/react-router'
import { createDefaultSocialService, SocialServiceError } from '@libs/social'
import { productRequestId, requireProductSession } from '@/lib/product-api'
import { socialServiceErrorResponse } from '@/lib/social-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/friend-requests/$id/accept')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request, params }: { request: Request; params: { id: string } }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          await createDefaultSocialService().acceptFriendRequest(auth.session.user.id, params.id)
          return Response.json({ status: 'accepted' }, {
            headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
          })
        } catch (error) {
          if (error instanceof SocialServiceError) {
            return socialServiceErrorResponse(requestId, error)
          }
          throw error
        }
      }),
    },
  },
})
