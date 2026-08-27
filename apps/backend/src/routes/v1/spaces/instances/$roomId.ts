import { createFileRoute } from '@tanstack/react-router'
import { spaceRuntimeSnapshotSchema } from '@vibechat/api-contracts'
import {
  authorizeSpaceRuntimeRequest,
  ensureSpaceTemplateProject,
  fetchSpaceRuntime,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { loadSpaceAgentPublicView } from '@/lib/space-agent-public-view'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/instances/$roomId')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        try {
          await ensureSpaceTemplateProject(access.instance)
          const response = await fetchSpaceRuntime(
            `/api/apps/${encodeURIComponent(access.instance.spaceInstanceId)}`,
          )
          if (!response.ok) {
            return productApiError(
              access.requestId,
              response.status === 503 ? 503 : 502,
              'SPACE_RUNTIME_UNAVAILABLE',
              'The Space Runtime is unavailable.',
            )
          }
          const raw = await response.json() as Record<string, any>
          const agentView = await loadSpaceAgentPublicView(access.instance)
          const project = raw.project as Record<string, unknown> | null
          const template = project?.template as Record<string, unknown> | undefined
          return Response.json(spaceRuntimeSnapshotSchema.parse({
            spaceInstanceId: access.instance.spaceInstanceId,
            matrixRoomId: access.instance.matrixRoomId,
            defaultAgentId: agentView.defaultAgentId,
            availableAgents: agentView.availableAgents,
            agents: agentView.agents,
            project: {
              exists: Boolean(raw.exists),
              draftId: typeof project?.draftId === 'string' ? project.draftId : null,
              releaseId: typeof project?.releaseId === 'string' ? project.releaseId : null,
              updatedAt: typeof project?.updatedAt === 'string' ? project.updatedAt : null,
              summary: typeof project?.summary === 'string' ? project.summary : null,
              template: template
                && typeof template.id === 'string'
                && typeof template.versionId === 'string'
                && typeof template.integrity === 'string'
                && template.projectFormat === 'agentos-app-v1'
                ? template
                : null,
            },
            devPreview: raw.devPreview,
            messages: raw.space?.messages ?? [],
            build: raw.space?.build ?? null,
            queue: raw.space?.queue ?? { activeCount: 0, pendingCount: 0 },
            appState: raw.space?.app ?? { revision: 0, state: {}, presence: [] },
          }), {
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
