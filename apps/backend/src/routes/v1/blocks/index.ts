import { createFileRoute } from '@tanstack/react-router'
import { blockUserSchema } from '@libs/chat'
import { createDefaultSocialService, SocialServiceError } from '@libs/social'
import { productApiError, productRequestId, requireProductSession } from '@/lib/product-api'
import { socialServiceErrorResponse } from '@/lib/social-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/blocks/')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = blockUserSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(requestId, 400, 'SOCIAL_BLOCK_INVALID', 'Invalid block request.')
          }
          await createDefaultSocialService().blockUser(auth.session.user.id, parsed.data.userId)
          return Response.json({ status: 'blocked' }, {
            status: 201,
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
