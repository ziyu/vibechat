import { createFileRoute } from '@tanstack/react-router'
import {
  applySpaceTemplateRequestSchema,
  spaceTurnAcceptedSchema,
} from '@vibechat/api-contracts'
import { getPublishedSpaceTemplate } from '@config'
import {
  authorizeSpaceRuntimeRequest,
  ensureSpaceTemplateProject,
  fetchSpaceRuntime,
  runtimeJsonInit,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/rooms/$roomId/apply-template')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const parsed = applySpaceTemplateRequestSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return productApiError(
            access.requestId,
            400,
            'SPACE_TEMPLATE_APPLY_REQUEST_INVALID',
            'The Space Template application request is invalid.',
          )
        }
        const template = getPublishedSpaceTemplate(parsed.data.spaceTemplateId)
        if (!template || template.versionId !== parsed.data.spaceTemplateVersionId) {
          return productApiError(
            access.requestId,
            404,
            'SPACE_TEMPLATE_VERSION_NOT_FOUND',
            'The requested Space Template Version is unavailable.',
          )
        }
        try {
          await ensureSpaceTemplateProject(access.instance)
          const response = await fetchSpaceRuntime(
            `/api/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/restore`,
            runtimeJsonInit({
              requestId: parsed.data.requestId,
              target: 'template',
              expectedReadyRevisionId: parsed.data.expectedReadyRevisionId,
              templateId: template.id,
              templateVersionId: template.versionId,
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
