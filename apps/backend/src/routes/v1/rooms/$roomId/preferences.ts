import { createFileRoute } from '@tanstack/react-router'
import { updateRoomPreferenceSchema } from '@vibechat/api-contracts'
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

export const Route = createFileRoute('/v1/rooms/$roomId/preferences')({
  server: {
    handlers: {
      PUT: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = updateRoomPreferenceSchema.safeParse({
            ...await request.json(),
            matrixRoomId: params.roomId,
          })
          if (!parsed.success) {
            return productApiError(requestId, 400, 'ROOM_PREFERENCE_INVALID', 'The room preference request is invalid.')
          }
          const preference = await createDefaultProductStateService().updateRoomPreference(
            auth.session.user.id,
            parsed.data,
          )
          return Response.json(preference, {
            headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productApiError(requestId, 400, 'ROOM_PREFERENCE_INVALID', 'The room preference request is invalid.')
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
