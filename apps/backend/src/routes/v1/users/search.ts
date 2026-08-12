import { createFileRoute } from '@tanstack/react-router'
import { userSearchResponseSchema } from '@libs/chat'
import { createDefaultSocialService } from '@libs/social'
import { productApiError, productRequestId, requireProductSession } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/users/search')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        const query = new URL(request.url).searchParams.get('q')?.trim() || ''
        if (query.length < 2 || query.length > 254) {
          return productApiError(
            requestId,
            400,
            'SOCIAL_SEARCH_QUERY_INVALID',
            'Search by username or full email.',
          )
        }
        const users = await createDefaultSocialService().searchUsers(auth.session.user.id, query)
        return Response.json(userSearchResponseSchema.parse({ users }), {
          headers: {
            'cache-control': 'private, no-store',
            'x-request-id': requestId,
          },
        })
      }),
    },
  },
})
