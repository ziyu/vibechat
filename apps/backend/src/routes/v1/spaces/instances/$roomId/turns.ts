import { createFileRoute } from '@tanstack/react-router'
import {
  createSpaceAgentTurnRequestSchema,
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
import { verifyMatrixAgentMention } from '@/lib/matrix-agent-mention'

export const Route = createFileRoute('/v1/spaces/instances/$roomId/turns')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        let reservation: Awaited<ReturnType<typeof import('@libs/ai').reserveChatCredits>> | undefined
        const billingContext = {
          userId: access.session.user.id,
          requestId: `space-agent:${access.instance.spaceInstanceId}:${stableRequestId(new URL(request.url).pathname)}`,
          provider: 'space-agent',
          model: access.instance.defaultAgentId,
        }
        try {
          const parsed = createSpaceAgentTurnRequestSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(access.requestId, 400, 'SPACE_AGENT_REQUEST_INVALID', 'The Agent request is invalid.')
          }
          const agentId = parsed.data.agentMention.id
          billingContext.model = agentId
          if (agentId !== access.instance.defaultAgentId) {
            return productApiError(access.requestId, 403, 'SPACE_AGENT_NOT_ALLOWED', 'The mentioned Agent is not enabled for this Space.')
          }
          const verifiedMention = await verifyMatrixAgentMention({
            userId: access.session.user.id,
            matrixRoomId: params.roomId,
            matrixEventId: parsed.data.matrixEventId,
            agentMention: parsed.data.agentMention,
          })
          if (!verifiedMention) {
            return productApiError(access.requestId, 400, 'SPACE_AGENT_MENTION_REQUIRED', 'A verified Agent mention is required to start a turn.')
          }

          const ai = await import('@libs/ai')
          billingContext.requestId = `space-agent:${access.instance.spaceInstanceId}:${stableRequestId(parsed.data.matrixEventId)}`
          reservation = await ai.reserveChatCredits(billingContext, [{
            id: parsed.data.matrixEventId,
            role: 'user',
            parts: [{ type: 'text', text: parsed.data.message }],
          }] as never)
          if (!reservation.success) {
            return productApiError(access.requestId, 402, 'INSUFFICIENT_CREDITS', reservation.error || 'Not enough credits.', {
              required: reservation.reservedCredits,
              balance: reservation.newBalance,
            })
          }

          await ensureSpaceTemplateProject(access.instance)
          const callbackOrigin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN?.trim() || 'http://localhost:8002'
          const response = await fetchSpaceRuntime(
            `/api/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/messages`,
            runtimeJsonInit({
              message: parsed.data.message,
              matrixEventId: parsed.data.matrixEventId,
              agentId,
              clientId: access.session.user.id,
              authorName: access.session.user.name || 'Member',
              billing: {
                callbackUrl: new URL('/v1/internal/space-agent-billing', callbackOrigin).href,
                completion: {
                  callbackUrl: new URL('/v1/internal/space-agent-completion', callbackOrigin).href,
                  spaceInstanceId: access.instance.spaceInstanceId,
                  matrixRoomId: access.instance.matrixRoomId,
                  matrixEventId: parsed.data.matrixEventId,
                },
                userId: access.session.user.id,
                requestId: billingContext.requestId,
                provider: billingContext.provider,
                model: billingContext.model,
                reservedCredits: reservation.reservedCredits,
                transactionId: reservation.transactionId,
              },
            }),
          )
          if (!response.ok) throw new Error('SPACE_RUNTIME_REJECTED')
          return Response.json(spaceTurnAcceptedSchema.parse(await response.json()), {
            status: 202,
            headers: { 'cache-control': 'private, no-store', 'x-request-id': access.requestId },
          })
        } catch (error) {
          if (reservation?.success && !reservation.idempotent) {
            const ai = await import('@libs/ai')
            await ai.refundChatCredits(billingContext, reservation, 'space_runtime_rejected').catch(() => undefined)
          }
          return productApiError(access.requestId, 503, 'SPACE_RUNTIME_UNAVAILABLE', 'The Space Runtime is unavailable.')
        }
      }),
    },
  },
})

function stableRequestId(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
