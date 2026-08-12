import { createFileRoute } from '@tanstack/react-router'
import { updateContactSchema } from '@libs/chat'
import { createDefaultSocialService, SocialServiceError } from '@libs/social'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from '@/lib/product-api'
import { socialServiceErrorResponse } from '@/lib/social-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/contacts/$userId')({
  server: {
    handlers: {
      PATCH: withCfDb(async ({
        request,
        params,
      }: { request: Request; params: { userId: string } }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = updateContactSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(
              requestId,
              400,
              'CONTACT_REQUEST_INVALID',
              'The contact request is invalid.',
              { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
            )
          }
          await createDefaultSocialService().updateContactRemark(
            auth.session.user.id,
            params.userId,
            parsed.data.remark,
          )
          return new Response(null, {
            status: 204,
            headers: { 'x-request-id': requestId },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productApiError(
              requestId,
              400,
              'CONTACT_REQUEST_INVALID',
              'The contact request is invalid.',
            )
          }
          if (error instanceof SocialServiceError) {
            return socialServiceErrorResponse(requestId, error)
          }
          throw error
        }
      }),
    },
  },
})
