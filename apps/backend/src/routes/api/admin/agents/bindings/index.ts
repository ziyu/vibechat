import { createFileRoute } from '@tanstack/react-router'
import { adminUpsertSpaceAgentBindingSchema } from '@vibechat/api-contracts'
import { AgentGovernanceError } from '@libs/space-agents'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/api/admin/agents/bindings/')({
  server: {
    handlers: {
      PUT: withCfDb(async ({ request }) => {
        const { requireAdminAPI } = await import('@/lib/admin-auth')
        const access = await requireAdminAPI(request)
        if (access instanceof Response) return access
        const parsed = adminUpsertSpaceAgentBindingSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return Response.json({ error: 'Invalid Space Agent binding.', issues: parsed.error.issues }, { status: 400 })
        }
        try {
          const { createSpaceAgentGovernanceService } = await import(
            '@/lib/space-agent-governance'
          )
          const binding = await (
            await createSpaceAgentGovernanceService()
          ).upsertBinding(parsed.data, access.user.id)
          return Response.json({ binding })
        } catch (error) {
          if (error instanceof AgentGovernanceError) {
            return Response.json({ error: error.message, code: error.code }, { status: 409 })
          }
          throw error
        }
      }),
    },
  },
})
