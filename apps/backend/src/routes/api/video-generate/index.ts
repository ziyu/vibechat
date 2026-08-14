import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'
import type { VideoGenerationOptions, VideoProviderName } from '@libs/ai'
import { config } from '@config'

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const Route = createFileRoute('/api/video-generate/')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        try {
          const [{ auth }, ai, { creditService, TransactionTypeCode }] = await Promise.all([
            import('@libs/auth'),
            import('@libs/ai'),
            import('@libs/credits'),
          ])
          const session = await auth.api.getSession({ headers: new Headers(request.headers) })
          const userId = session?.user?.id
          if (!userId) return Response.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })

          const body = await request.json().catch(() => null) as Record<string, unknown> | null
          const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
          const provider = typeof body?.provider === 'string' ? body.provider : config.aiVideo.defaultProvider
          const requestId = body?.requestId
          if (!prompt || prompt.length > 4000) return Response.json({ error: 'invalid_prompt', message: 'Prompt must contain 1-4000 characters' }, { status: 400 })
          if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) return Response.json({ error: 'invalid_request_id', message: 'A valid requestId is required' }, { status: 400 })
          if (!(provider in config.aiVideo.availableModels)) return Response.json({ error: 'invalid_provider', message: 'Unsupported video provider' }, { status: 400 })

          const providerName = provider as VideoProviderName
          const model = typeof body?.model === 'string' ? body.model : config.aiVideo.defaultModels[providerName]
          const availableModels = config.aiVideo.availableModels[providerName] as readonly string[]
          if (!availableModels.includes(model)) return Response.json({ error: 'invalid_model', message: 'Unsupported model for provider' }, { status: 400 })

          const sizeOptions = ai.getVideoSizesForProvider(providerName).map((entry) => entry.value)
          const requestedSize = typeof body?.size === 'string' ? body.size : undefined
          const requestedAspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : undefined
          const normalizedSize = providerName === 'fal' ? requestedAspectRatio : requestedSize
          if (normalizedSize && !sizeOptions.includes(normalizedSize as never)) return Response.json({ error: 'invalid_size', message: 'Unsupported video size' }, { status: 400 })

          const duration = typeof body?.duration === 'number' && Number.isInteger(body.duration) ? body.duration : undefined
          const durations = ai.getVideoDurationsForProvider(providerName) as readonly number[]
          if (duration !== undefined && !durations.includes(duration)) return Response.json({ error: 'invalid_duration', message: 'Unsupported video duration' }, { status: 400 })
          if (body?.firstFrameUrl !== undefined && !isHttpUrl(body.firstFrameUrl)) return Response.json({ error: 'invalid_first_frame', message: 'firstFrameUrl must be an HTTP URL' }, { status: 400 })
          if (body?.lastFrameUrl !== undefined && !isHttpUrl(body.lastFrameUrl)) return Response.json({ error: 'invalid_last_frame', message: 'lastFrameUrl must be an HTTP URL' }, { status: 400 })

          const taskId = requestId.startsWith('video:') ? requestId : `video:${requestId}`
          const existing = await ai.getVideoTaskRecord(taskId)
          if (existing && existing.userId !== userId) return Response.json({ error: 'not_found', message: 'Task not found' }, { status: 404 })
          if (existing?.status === 'succeeded' && existing.result) {
            return Response.json({ success: true, data: existing.result, idempotent: true, credits: { consumed: existing.creditCost, remaining: await creditService.getBalance(userId) } })
          }
          if (existing?.status === 'failed') return Response.json({ error: 'generation_failed', message: existing.errorMessage || 'Generation failed; retry with a new requestId' }, { status: 409 })
          if (existing) {
            return Response.json({ success: true, data: { taskId, status: 'processing', async: true, provider: existing.provider, model: existing.model }, credits: { consumed: existing.creditCost, remaining: await creditService.getBalance(userId) } })
          }

          const options: VideoGenerationOptions = {
            prompt,
            provider: providerName,
            model,
            size: providerName === 'fal' ? undefined : requestedSize,
            aspectRatio: providerName === 'fal' ? requestedAspectRatio : undefined,
            duration,
            seed: typeof body?.seed === 'number' && Number.isInteger(body.seed) ? body.seed : undefined,
            loop: providerName === 'fal' && typeof body?.loop === 'boolean' ? body.loop : undefined,
            motionStrength: providerName === 'fal' && typeof body?.motionStrength === 'number' ? Math.min(1, Math.max(0, body.motionStrength)) : undefined,
            promptExtend: providerName === 'aliyun' && typeof body?.promptExtend === 'boolean' ? body.promptExtend : undefined,
            watermark: providerName !== 'fal' && typeof body?.watermark === 'boolean' ? body.watermark : undefined,
            firstFrameUrl: isHttpUrl(body?.firstFrameUrl) ? body.firstFrameUrl : undefined,
            lastFrameUrl: isHttpUrl(body?.lastFrameUrl) ? body.lastFrameUrl : undefined,
          }

          const creditCost = ai.calculateVideoCreditCost({ provider: providerName, model })
          const consumeTransactionId = `ai-video:${taskId}`
          const consumeResult = await creditService.consumeCredits({
            userId,
            amount: creditCost,
            description: TransactionTypeCode.AI_VIDEO_GENERATION,
            metadata: { provider, model, taskId },
            transactionId: consumeTransactionId,
          })
          if (!consumeResult.success) return Response.json({ error: 'insufficient_credits', message: consumeResult.error || 'Not enough credits', required: creditCost, balance: consumeResult.newBalance }, { status: 402 })

          const reservation = await ai.reserveVideoTaskRecord({
            id: taskId,
            userId,
            provider: providerName,
            model,
            creditCost,
            consumeTransactionId,
          })
          if (!reservation.created) {
            return Response.json({ success: true, data: { taskId, status: reservation.task.status, async: true, provider, model }, credits: { consumed: creditCost, remaining: consumeResult.newBalance } })
          }

          try {
            if (providerName !== 'fal') {
              const asyncTask = await ai.createVideoTask(options)
              await ai.attachVideoProviderTask(taskId, asyncTask.providerTaskId)
              return Response.json({ success: true, data: { taskId, status: 'processing', async: true, provider, model }, credits: { consumed: creditCost, remaining: consumeResult.newBalance } })
            }

            const result = await ai.generateVideoResponse(options)
            await ai.markVideoTaskSucceeded(taskId, result)
            return Response.json({ success: true, data: result, credits: { consumed: creditCost, remaining: consumeResult.newBalance } })
          } catch (generationError) {
            const message = 'Video provider request failed'
            let refunded = false
            try {
              await creditService.addCredits({
                userId,
                amount: creditCost,
                type: 'refund',
                transactionId: `refund:${consumeTransactionId}`,
                description: TransactionTypeCode.REFUND,
                metadata: { originalTransactionId: consumeTransactionId, provider, model, error: message },
              })
              refunded = true
            } finally {
              await ai.markVideoTaskFailed(taskId, message)
              if (refunded) await ai.markVideoTaskRefunded(taskId)
            }
            throw generationError
          }
        } catch (error) {
          const { summarizeAIError } = await import('@libs/ai')
          console.error('Video generation API error:', summarizeAIError(error))
          return Response.json({ error: 'generation_failed', message: 'Video generation failed. Please retry.' }, { status: 500 })
        }
      }),
    },
  },
})
