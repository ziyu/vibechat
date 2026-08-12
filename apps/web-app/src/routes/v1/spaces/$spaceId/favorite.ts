import { createFileRoute } from '@tanstack/react-router'
import { updateSpaceFavoriteSchema } from '@libs/chat'
import {
  createDefaultProductStateService,
  ProductStateError,
} from '@libs/product-state'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/$spaceId/favorite')({
  server: {
    handlers: {
      PUT: withCfDb(async ({ request, params }: { request: Request; params: { spaceId: string } }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = updateSpaceFavoriteSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(requestId, 400, 'SPACE_FAVORITE_INVALID', 'The favorite request is invalid.')
          }
          await createDefaultProductStateService().setSpaceFavorite(
            auth.session.user.id,
            params.spaceId,
            parsed.data.favorite,
          )
          return Response.json({ spaceId: params.spaceId, favorite: parsed.data.favorite }, {
            headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productApiError(requestId, 400, 'SPACE_FAVORITE_INVALID', 'The favorite request is invalid.')
          }
          if (error instanceof ProductStateError) {
            return productApiError(requestId, 404, error.code, error.code)
          }
          throw error
        }
      }),
    },
  },
})
