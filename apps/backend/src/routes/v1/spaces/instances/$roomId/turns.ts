import { createFileRoute } from '@tanstack/react-router'
import {
  cancelSpaceAgentTurnRequestSchema,
  createSpaceAgentTurnRequestSchema,
} from '@vibechat/api-contracts'
import { authorizeSpaceRuntimeRequest } from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'
import {
  createSpaceAgentInvocationService,
  SpaceAgentInvocationError,
} from '@/lib/space-agent-invocation'
import {
  createSpaceAgentCancellationService,
  SpaceAgentCancellationError,
} from '@/lib/space-agent-cancellation'

export const Route = createFileRoute('/v1/spaces/instances/$roomId/turns')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        try {
          const parsed = createSpaceAgentTurnRequestSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(access.requestId, 400, 'SPACE_AGENT_REQUEST_INVALID', 'The Agent request is invalid.')
          }
          const service = await createSpaceAgentInvocationService()
          const accepted = await service.invoke({
            instance: access.instance,
            user: access.session.user,
            request: parsed.data,
          })
          return Response.json(accepted, {
            status: 202,
            headers: { 'cache-control': 'private, no-store', 'x-request-id': access.requestId },
          })
        } catch (error) {
          if (error instanceof SpaceAgentInvocationError) {
            return productApiError(
              access.requestId,
              error.status,
              error.code,
              error.message,
              error.details,
            )
          }
          return productApiError(access.requestId, 503, 'SPACE_RUNTIME_UNAVAILABLE', 'The Space Runtime is unavailable.')
        }
      }),
      DELETE: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const parsed = cancelSpaceAgentTurnRequestSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return productApiError(
            access.requestId,
            400,
            'SPACE_AGENT_CANCEL_REQUEST_INVALID',
            'The Agent cancellation request is invalid.',
          )
        }
        try {
          const service = await createSpaceAgentCancellationService()
          const accepted = await service.cancel({
            spaceInstanceId: access.instance.spaceInstanceId,
            userId: access.session.user.id,
            turnId: parsed.data.turnId,
          })
          return Response.json(accepted, {
            status: 202,
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': access.requestId,
            },
          })
        } catch (error) {
          if (error instanceof SpaceAgentCancellationError) {
            return productApiError(
              access.requestId,
              error.status,
              error.code,
              error.message,
            )
          }
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
