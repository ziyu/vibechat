import { createFileRoute } from '@tanstack/react-router'
import {
  productStateSnapshotSchema,
  updateProductPreferencesSchema,
} from '@vibechat/api-contracts'
import { createDefaultProductStateService } from '@libs/product-state'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/product-state')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        const snapshot = await createDefaultProductStateService()
          .getSnapshot(auth.session.user.id)
        return Response.json(productStateSnapshotSchema.parse(snapshot), {
          headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
        })
      }),
      PATCH: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = updateProductPreferencesSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(requestId, 400, 'PRODUCT_PREFERENCES_INVALID', 'The preferences request is invalid.')
          }
          const service = createDefaultProductStateService()
          const current = await service.getSnapshot(auth.session.user.id)
          const preferences = await service.updatePreferences(
            auth.session.user.id,
            current.preferences,
            parsed.data,
          )
          return Response.json(preferences, {
            headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productApiError(requestId, 400, 'PRODUCT_PREFERENCES_INVALID', 'The preferences request is invalid.')
          }
          throw error
        }
      }),
    },
  },
})
