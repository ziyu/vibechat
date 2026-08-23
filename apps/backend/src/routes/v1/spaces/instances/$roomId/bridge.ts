import { createFileRoute } from '@tanstack/react-router'
import {
  spaceAppBridgeRequestSchema,
  spaceAppBridgeResponseSchema,
} from '@vibechat/api-contracts'
import {
  authorizeSpaceRuntimeRequest,
  fetchSpaceRuntime,
  runtimeJsonInit,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/instances/$roomId/bridge')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const parsed = spaceAppBridgeRequestSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success || parsed.data.action === 'chat.send' || parsed.data.action === 'theme.set') {
          return productApiError(
            access.requestId,
            400,
            'SPACE_APP_COMMAND_INVALID',
            'The Space App command is invalid.',
          )
        }
        try {
          const response = await fetchSpaceRuntime(
            `/api/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/bridge`,
            runtimeJsonInit({
              clientId: access.session.user.id,
              authorName: access.session.user.name || 'Member',
              ...parsed.data,
            }),
          )
          if (!response.ok) throw new Error('SPACE_RUNTIME_REJECTED')
          return Response.json(spaceAppBridgeResponseSchema.parse(await response.json()), {
            headers: { 'cache-control': 'private, no-store', 'x-request-id': access.requestId },
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
