import { productApiErrorSchema } from '@libs/chat'

export function productRequestId(request: Request) {
  return request.headers.get('x-request-id') || globalThis.crypto.randomUUID()
}

export function productApiError(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return Response.json(productApiErrorSchema.parse({
    error: { code, message, details, requestId },
  }), {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-request-id': requestId,
    },
  })
}

export async function requireProductSession(request: Request, requestId: string) {
  const { auth } = await import('@libs/auth')
  const session = await auth.api.getSession({ headers: new Headers(request.headers) })
  if (!session?.user?.id) {
    return {
      ok: false,
      response: productApiError(
        requestId,
        401,
        'AUTH_SESSION_REQUIRED',
        'An authenticated session is required.',
      ),
    } as const
  }
  return { ok: true, session } as const
}
