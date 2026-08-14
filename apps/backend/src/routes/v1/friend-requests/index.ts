import { createFileRoute } from '@tanstack/react-router'
import { sendFriendRequestSchema, socialSnapshotSchema } from '@vibechat/api-contracts'
import { createDefaultSocialService, SocialServiceError } from '@libs/social'
import { productApiError, productRequestId, requireProductSession } from '@/lib/product-api'
import { socialServiceErrorResponse } from '@/lib/social-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/friend-requests/')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        const snapshot = await createDefaultSocialService().getSnapshot(auth.session.user.id)
        return Response.json(socialSnapshotSchema.parse(snapshot), {
          headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
        })
      }),
      POST: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = sendFriendRequestSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(
              requestId,
              400,
              'SOCIAL_REQUEST_INVALID',
              'The friend request is invalid.',
            )
          }
          const created = await createDefaultSocialService().sendFriendRequest(
            auth.session.user.id,
            parsed.data.recipientUserId,
          )
          return Response.json({ id: created.id, status: created.status }, {
            status: 201,
            headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
          })
        } catch (error) {
          if (error instanceof SocialServiceError) {
            return socialServiceErrorResponse(requestId, error)
          }
          if (error instanceof SyntaxError) {
            return productApiError(requestId, 400, 'SOCIAL_REQUEST_INVALID', 'Invalid JSON.')
          }
          throw error
        }
      }),
    },
  },
})
