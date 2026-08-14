import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/api/video-generate/status')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        try {
          const { auth } = await import('@libs/auth')
          const { queryVideoTask } = await import('@libs/ai')
          const {
            getVideoTaskRecord,
            markVideoTaskSucceeded,
            markVideoTaskFailed,
            markVideoTaskRefunded,
          } = await import('@libs/ai/video-task-store')
          const { creditService } = await import('@libs/credits')

          const session = await auth.api.getSession({ headers: new Headers(request.headers) })
          const userId = session?.user?.id
          if (!userId) {
            return new Response(
              JSON.stringify({ error: 'unauthorized', message: 'Authentication required' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const requestUrl = new URL(request.url)
          const taskId = requestUrl.searchParams.get('taskId')
          if (!taskId) {
            return new Response(
              JSON.stringify({ error: 'invalid_request', message: 'taskId is required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const task = await getVideoTaskRecord(taskId)
          if (!task || task.userId !== userId) {
            return new Response(
              JSON.stringify({ error: 'not_found', message: 'Task not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            )
          }

          if (task.status === 'succeeded' && task.result) {
            const balance = await creditService.getBalance(userId)
            return new Response(
              JSON.stringify({ success: true, data: { taskId, status: 'succeeded', result: task.result }, credits: { remaining: balance } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }

          if (task.status === 'failed') {
            const balance = await creditService.getBalance(userId)
            return new Response(
              JSON.stringify({ success: true, data: { taskId, status: 'failed', error: task.errorMessage || 'Video generation failed' }, credits: { remaining: balance } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }

          if (!task.providerTaskId || task.provider === 'fal') {
            const isStale = Date.now() - task.updatedAt > 2 * 60 * 1000
            if (!isStale) {
              return Response.json({ success: true, data: { taskId, status: 'processing' } })
            }
            const failureMessage = 'Video generation was interrupted before a provider task was confirmed'
            if (!task.refunded && task.creditCost > 0) {
              await creditService.addCredits({
                userId,
                amount: task.creditCost,
                type: 'refund',
                transactionId: `refund:${task.consumeTransactionId}`,
                description: 'Refund for interrupted video generation',
                metadata: { originalTransactionId: task.consumeTransactionId, provider: task.provider, model: task.model },
              })
              await markVideoTaskRefunded(taskId)
            }
            await markVideoTaskFailed(taskId, failureMessage)
            return Response.json({ success: true, data: { taskId, status: 'failed', error: failureMessage }, credits: { remaining: await creditService.getBalance(userId) } })
          }

          const providerTask = await queryVideoTask(task.provider, task.model, task.providerTaskId)
          if (providerTask.status === 'processing') {
            return new Response(
              JSON.stringify({ success: true, data: { taskId, status: 'processing' } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }

          if (providerTask.status === 'succeeded' && providerTask.result) {
            await markVideoTaskSucceeded(taskId, providerTask.result)
            const balance = await creditService.getBalance(userId)
            return new Response(
              JSON.stringify({ success: true, data: { taskId, status: 'succeeded', result: providerTask.result }, credits: { remaining: balance } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const failureMessage = providerTask.errorMessage || 'Video generation failed'
          if (!task.refunded && task.creditCost > 0) {
            try {
              await creditService.addCredits({
                userId, amount: task.creditCost, type: 'refund',
                transactionId: `refund:${task.consumeTransactionId}`,
                description: 'Refund for failed video generation',
                metadata: { originalTransactionId: task.consumeTransactionId, provider: task.provider, model: task.model, error: failureMessage },
              })
              await markVideoTaskRefunded(taskId)
            } catch (refundError) {
              const { summarizeAIError } = await import('@libs/ai')
              console.error('CRITICAL: Failed to refund credits after async video failure:', {
                userId, taskId, error: summarizeAIError(refundError),
              })
            }
          }

          await markVideoTaskFailed(taskId, failureMessage)
          const balance = await creditService.getBalance(userId)
          return new Response(
            JSON.stringify({ success: true, data: { taskId, status: 'failed', error: failureMessage }, credits: { remaining: balance } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          const { summarizeAIError } = await import('@libs/ai')
          console.error('Video status API error:', summarizeAIError(error))
          return new Response(
            JSON.stringify({ error: 'status_query_failed', message: error instanceof Error ? error.message : 'Unknown error occurred' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }),
    },
  },
})
