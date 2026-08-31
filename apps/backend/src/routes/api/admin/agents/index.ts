import { createFileRoute } from '@tanstack/react-router'
import {
  adminAgentGovernanceQuerySchema,
  adminAgentGovernanceSnapshotSchema,
} from '@vibechat/api-contracts'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/api/admin/agents/')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const { requireAdminAPI } = await import('@/lib/admin-auth')
        const access = await requireAdminAPI(request)
        if (access instanceof Response) return access
        const parsed = adminAgentGovernanceQuerySchema.safeParse(
          Object.fromEntries(new URL(request.url).searchParams),
        )
        if (!parsed.success) {
          return Response.json({ error: 'Invalid Agent governance query.' }, { status: 400 })
        }
        const { createSpaceAgentGovernanceService } = await import(
          '@/lib/space-agent-governance'
        )
        const snapshot = await (await createSpaceAgentGovernanceService()).snapshot(parsed.data)
        return Response.json(adminAgentGovernanceSnapshotSchema.parse({
          ...snapshot,
          audit: snapshot.audit.map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })),
        }), {
          headers: { 'cache-control': 'private, no-store' },
        })
      }),
    },
  },
})
