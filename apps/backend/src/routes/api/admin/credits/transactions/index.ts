import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/api/admin/credits/transactions/')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        try {
          const { requireAdminAPI } = await import('@/lib/admin-auth')
          const authResult = await requireAdminAPI(request)
          if (authResult instanceof Response) return authResult

          const { searchParams } = new URL(request.url)
          const { adminCreditTransactionsQuerySchema } = await import('@vibechat/api-contracts/admin')
          const parsed = adminCreditTransactionsQuerySchema.safeParse(Object.fromEntries(searchParams))
          if (!parsed.success) {
            return Response.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 })
          }
          const { creditLedgerQueryService } = await import('@libs/credits/service')
          const result = await creditLedgerQueryService.getAllTransactionsPaginated(parsed.data)

          return Response.json({
            transactions: result.transactions,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
          })
        } catch (error) {
          console.error('Error fetching credit transactions:', error)
          return new Response('Internal Server Error', { status: 500 })
        }
      }),
    },
  },
})
