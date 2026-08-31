import { createFileRoute } from '@tanstack/react-router'
import { DatabaseSpaceRuntimeControlPlane } from '@libs/space-runtime-control'
import { spaceProjectRevisionListSchema } from '@vibechat/api-contracts'
import { authorizeSpaceRuntimeRequest } from '@/lib/space-runtime'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/rooms/$roomId/revisions')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request, params }: {
        request: Request
        params: { roomId: string }
      }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const control = new DatabaseSpaceRuntimeControlPlane()
        const [project, revisions] = await Promise.all([
          control.loadProject(access.instance.spaceInstanceId),
          control.listProjectRevisions(access.instance.spaceInstanceId, 50),
        ])
        const body = spaceProjectRevisionListSchema.parse({
          revisions: revisions.map((revision) => ({
            revisionId: revision.revisionId,
            parentRevisionId: revision.parentRevisionId,
            sourceHash: revision.sourceHash,
            createdAt: revision.createdAt.toISOString(),
            template: projectRevisionTemplateSummary(revision.metadata),
            isReady: project?.readyRevisionId === revision.revisionId,
            isPublished: project?.publishedRevisionId === revision.revisionId,
          })),
        })
        return Response.json(body, {
          headers: {
            'cache-control': 'private, no-store',
            'x-request-id': access.requestId,
          },
        })
      }),
    },
  },
})

function projectRevisionTemplateSummary(metadata: Record<string, unknown>) {
  const template = metadata.template
  if (!template || typeof template !== 'object') return null
  const value = template as Record<string, unknown>
  return typeof value.id === 'string' && typeof value.versionId === 'string'
    ? { id: value.id, versionId: value.versionId }
    : null
}
