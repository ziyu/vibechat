import { createFileRoute } from '@tanstack/react-router'
import {
  restoreSpaceAppRequestSchema,
  spaceTurnAcceptedSchema,
} from '@vibechat/api-contracts'
import {
  authorizeSpaceRuntimeRequest,
  ensureSpaceTemplateProject,
  fetchSpaceRuntime,
  runtimeJsonInit,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/instances/$roomId/restore')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const parsed = restoreSpaceAppRequestSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return productApiError(
            access.requestId,
            400,
            'SPACE_RESTORE_REQUEST_INVALID',
            'The Space restore request is invalid.',
          )
        }
        try {
          await ensureSpaceTemplateProject(access.instance)
          const response = await fetchSpaceRuntime(
            `/api/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/restore`,
            runtimeJsonInit({
              ...parsed.data,
              clientId: access.session.user.id,
              authorName: access.session.user.name || 'Member',
            }),
          )
          if (!response.ok) throw new Error('SPACE_RUNTIME_REJECTED')
          return Response.json(spaceTurnAcceptedSchema.parse(await response.json()), {
            status: 202,
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': access.requestId,
            },
          })
        } catch {
          return productApiError(
            access.requestId,
            503,
            'SPACE_RUNTIME_UNAVAILABLE',
            'The Space Runtime is unavailable.',
          )
        }
      }),
    },
  },
})
