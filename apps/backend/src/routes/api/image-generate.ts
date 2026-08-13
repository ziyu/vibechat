import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'
import type { ImageGenerationOptions, ImageProviderName } from '@libs/ai'
import { config } from '@config'

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/

export const Route = createFileRoute('/api/image-generate')({
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
          const provider = typeof body?.provider === 'string' ? body.provider : config.aiImage.defaultProvider
          const requestId = body?.requestId
          if (!prompt || prompt.length > 4000) return Response.json({ error: 'invalid_prompt', message: 'Prompt must contain 1-4000 characters' }, { status: 400 })
          if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) return Response.json({ error: 'invalid_request_id', message: 'A valid requestId is required' }, { status: 400 })
          if (!(provider in config.aiImage.availableModels)) return Response.json({ error: 'invalid_provider', message: 'Unsupported image provider' }, { status: 400 })

          const providerName = provider as ImageProviderName
          const model = typeof body?.model === 'string'
            ? body.model
            : config.aiImage.defaultModels[providerName]
          const availableModels = config.aiImage.availableModels[providerName] as readonly string[]
          if (!availableModels.includes(model)) return Response.json({ error: 'invalid_model', message: 'Unsupported model for provider' }, { status: 400 })

          const taskId = requestId.startsWith('image:') ? requestId : `image:${requestId}`
          const existing = await ai.getImageTaskRecord(taskId)
          if (existing && existing.userId !== userId) return Response.json({ error: 'not_found', message: 'Task not found' }, { status: 404 })
          if (existing?.status === 'succeeded' && existing.result) {
            return Response.json({ success: true, data: existing.result, idempotent: true, credits: { consumed: existing.creditCost, remaining: await creditService.getBalance(userId) } })
          }
          if (existing) return Response.json({ error: `generation_${existing.status}`, message: existing.errorMessage || 'Generation is already processing' }, { status: 409 })

          const creditCost = ai.calculateImageCreditCost({ provider: providerName, model })
          const consumeTransactionId = `ai-image:${taskId}`
          const consumeResult = await creditService.consumeCredits({
            userId,
            amount: creditCost,
            transactionId: consumeTransactionId,
            description: TransactionTypeCode.AI_IMAGE_GENERATION,
            metadata: { provider, model, taskId },
          })
          if (!consumeResult.success) return Response.json({ error: 'insufficient_credits', message: consumeResult.error || 'Not enough credits', required: creditCost, balance: consumeResult.newBalance }, { status: 402 })
          if (consumeResult.idempotent) return Response.json({ error: 'duplicate_request', message: 'This generation request was already processed' }, { status: 409 })

          await ai.createImageTaskRecord({ id: taskId, userId, provider: providerName, model, creditCost, consumeTransactionId })
          const sizeOptions = ai.getImageSizesForProvider(providerName).map((entry) => entry.value)
          const requestedSize = typeof body?.size === 'string' ? body.size : undefined
          const requestedAspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : undefined
          const normalizedValue = providerName === 'fal' || providerName === 'gemini' ? requestedAspectRatio : requestedSize
          if (normalizedValue && !sizeOptions.includes(normalizedValue as never)) {
            await creditService.addCredits({ userId, amount: creditCost, type: 'refund', transactionId: `refund:${consumeTransactionId}`, description: TransactionTypeCode.REFUND })
            await ai.markImageTaskFailed(taskId, 'Unsupported image size', true)
            return Response.json({ error: 'invalid_size', message: 'Unsupported image size' }, { status: 400 })
          }

          const options: ImageGenerationOptions = {
            prompt,
            provider: providerName,
            model,
            negativePrompt: typeof body?.negativePrompt === 'string' ? body.negativePrompt.slice(0, 2000) : undefined,
            size: providerName === 'fal' || providerName === 'gemini' ? undefined : requestedSize,
            aspectRatio: providerName === 'fal' || providerName === 'gemini' ? requestedAspectRatio : undefined,
            seed: typeof body?.seed === 'number' && Number.isInteger(body.seed) ? body.seed : undefined,
            promptExtend: providerName === 'qwen' && typeof body?.promptExtend === 'boolean' ? body.promptExtend : undefined,
            watermark: providerName === 'qwen' && typeof body?.watermark === 'boolean' ? body.watermark : undefined,
            numInferenceSteps: providerName === 'fal' && typeof body?.numInferenceSteps === 'number' ? Math.min(50, Math.max(1, Math.round(body.numInferenceSteps))) : undefined,
            guidanceScale: providerName === 'fal' && typeof body?.guidanceScale === 'number' ? Math.min(20, Math.max(1, body.guidanceScale)) : undefined,
          }

          try {
            const result = await ai.generateImageResponse(options)
            await ai.markImageTaskSucceeded(taskId, result)
            return Response.json({ success: true, data: result, credits: { consumed: creditCost, remaining: consumeResult.newBalance } })
          } catch (error) {
            const message = 'Image provider request failed'
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
              await ai.markImageTaskFailed(taskId, message, refunded)
            }
            throw error
          }
        } catch (error) {
          const { summarizeAIError } = await import('@libs/ai')
          console.error('Image generation API error:', summarizeAIError(error))
          return Response.json({ error: 'generation_failed', message: 'Image generation failed. Please retry.' }, { status: 500 })
        }
      }),
    },
  },
})
