import { createFileRoute } from '@tanstack/react-router'
import { adminSetAgentDefinitionFrozenSchema } from '@vibechat/api-contracts'
import { AgentGovernanceError } from '@libs/space-agents'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/api/admin/agents/definitions/$definitionId/status')({
  server: {
    handlers: {
      PATCH: withCfDb(async ({ request, params }: {
        request: Request
        params: { definitionId: string }
      }) => {
        const { requireAdminAPI } = await import('@/lib/admin-auth')
        const access = await requireAdminAPI(request)
        if (access instanceof Response) return access
        const parsed = adminSetAgentDefinitionFrozenSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return Response.json({ error: 'Invalid Agent Definition status.' }, { status: 400 })
        }
        try {
          const { createSpaceAgentGovernanceService } = await import(
            '@/lib/space-agent-governance'
          )
          const definition = await (
            await createSpaceAgentGovernanceService()
          ).setDefinitionFrozen({
            definitionId: params.definitionId,
            frozen: parsed.data.frozen,
            actorUserId: access.user.id,
          })
          return Response.json({ definition })
        } catch (error) {
          if (error instanceof AgentGovernanceError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.code === 'AGENT_DEFINITION_NOT_FOUND' ? 404 : 409 },
            )
          }
          throw error
        }
      }),
    },
  },
})
