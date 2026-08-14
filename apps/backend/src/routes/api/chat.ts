import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/

function jsonError(status: number, error: string, message: string, details: Record<string, unknown> = {}) {
  return Response.json({ error, message, ...details }, { status })
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        let refundFailure: (() => Promise<unknown>) | undefined
        try {
          const [{ auth }, ai, { config }, { withFreshRequestClient }] = await Promise.all([
            import('@libs/auth'),
            import('@libs/ai'),
            import('@config'),
            import('@libs/database'),
          ])
          const session = await auth.api.getSession({ headers: new Headers(request.headers) })
          const userId = session?.user?.id
          if (!userId) return jsonError(401, 'unauthorized', 'Authentication required')

          const body = await request.json().catch(() => null) as Record<string, unknown> | null
          const messages = body?.messages
          const provider = body?.provider
          const requestedModel = body?.model
          const requestId = body?.requestId
          if (!Array.isArray(messages) || messages.length === 0 || messages.length > ai.CHAT_MAX_MESSAGES) {
            return jsonError(400, 'invalid_messages', `messages must contain 1-${ai.CHAT_MAX_MESSAGES} items`)
          }
          if (!messages.every((message) => message && typeof message === 'object'
            && ['system', 'user', 'assistant'].includes(String((message as { role?: unknown }).role)))) {
            return jsonError(400, 'invalid_messages', 'Each message must have a supported role')
          }
          const requestBytes = ai.getChatRequestBytes(messages as import('ai').UIMessage[])
          if (requestBytes > ai.CHAT_MAX_REQUEST_BYTES) {
            return jsonError(413, 'request_too_large', 'Chat request is too large', { maxBytes: ai.CHAT_MAX_REQUEST_BYTES })
          }
          if (typeof provider !== 'string' || !(provider in config.ai.availableModels)) {
            return jsonError(400, 'invalid_provider', 'Unsupported AI provider')
          }
          const availableModels = config.ai.availableModels[provider as keyof typeof config.ai.availableModels] as readonly string[]
          const model = typeof requestedModel === 'string'
            ? requestedModel
            : config.ai.defaultModels[provider as keyof typeof config.ai.defaultModels]
          if (!availableModels.includes(model)) {
            return jsonError(400, 'invalid_model', 'Unsupported model for provider')
          }
          if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
            return jsonError(400, 'invalid_request_id', 'A valid requestId is required')
          }

          const context = { userId, requestId, provider, model }
          const reservation = await ai.reserveChatCredits(context, messages as import('ai').UIMessage[])
          if (!reservation.success) {
            return jsonError(402, 'insufficient_credits', reservation.error || 'Not enough credits', {
              required: reservation.reservedCredits,
              balance: reservation.newBalance,
            })
          }
          if (reservation.idempotent) {
            return jsonError(409, 'duplicate_request', 'This chat request was already processed')
          }

          refundFailure = () => withFreshRequestClient(() => ai.refundChatCredits(context, reservation, 'generation_setup_failed'))
          let stream
          try {
            stream = await ai.streamResponseWithUsage({
              messages: messages as import('ai').UIMessage[],
              provider: provider as import('@libs/ai').ChatProviderName,
              model,
              maxOutputTokens: ai.CHAT_MAX_OUTPUT_TOKENS,
              abortSignal: request.signal,
            })
          } catch (error) {
            await refundFailure()
            refundFailure = undefined
            throw error
          }

          const originalBody = stream.response.body
          if (!originalBody) {
            await refundFailure()
            refundFailure = undefined
            return jsonError(502, 'empty_stream', 'AI provider returned an empty stream')
          }

          const { readable, writable } = new TransformStream()
          const reader = originalBody.getReader()
          const writer = writable.getWriter()
          let settled = false
          void (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                await writer.write(value)
              }
              const usage = await stream.usage
              await withFreshRequestClient(() => ai.settleChatCredits(context, reservation, usage))
              settled = true
              await writer.close()
            } catch (error) {
              console.error('[AI chat] stream or settlement failed:', {
                userId, requestId, provider, model, error: ai.summarizeAIError(error),
              })
              if (!settled) {
                try {
                  await withFreshRequestClient(() => ai.refundChatCredits(context, reservation, 'stream_failed'))
                } catch (refundError) {
                  console.error('[AI chat] critical refund failure:', {
                    userId, requestId, error: ai.summarizeAIError(refundError),
                  })
                }
              }
              await writer.abort(error).catch(() => undefined)
            } finally {
              reader.releaseLock()
            }
          })()
          refundFailure = undefined

          return new Response(readable, {
            status: stream.response.status,
            headers: stream.response.headers,
          })
        } catch (error) {
          if (refundFailure) {
            try { await refundFailure() } catch (refundError) {
              const { summarizeAIError } = await import('@libs/ai')
              console.error('[AI chat] critical setup refund failure:', summarizeAIError(refundError))
            }
          }
          const { summarizeAIError } = await import('@libs/ai')
          console.error('AI chat API error:', summarizeAIError(error))
          return jsonError(500, 'generation_failed', 'AI chat failed. Please retry.')
        }
      }),
    },
  },
})
