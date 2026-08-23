import { createDefaultRoomService } from '@libs/rooms'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from './product-api'

export async function authorizeSpaceRuntimeRequest(request: Request, matrixRoomId: string) {
  const requestId = productRequestId(request)
  const auth = await requireProductSession(request, requestId)
  if (!auth.ok) return auth
  const instance = await createDefaultRoomService().getAccessibleSpaceInstance(
    auth.session.user.id,
    matrixRoomId,
  )
  if (!instance) {
    return {
      ok: false,
      response: productApiError(
        requestId,
        404,
        'SPACE_INSTANCE_NOT_FOUND',
        'The Space is unavailable to this account.',
      ),
    } as const
  }
  return { ok: true, requestId, session: auth.session, instance } as const
}

export async function fetchSpaceRuntime(
  path: string,
  init: RequestInit = {},
) {
  const origin = process.env.SPACE_RUNTIME_ORIGIN?.trim()
  const token = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
  if (!origin || !token) throw new SpaceRuntimeConfigurationError()
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  headers.set('accept', headers.get('accept') || 'application/json')
  return fetch(new URL(path, origin), { ...init, headers, redirect: 'manual' })
}

export function runtimeJsonInit(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  }
}

export function proxySpaceRuntimeResponse(response: Response, options: { app?: boolean } = {}) {
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  headers.delete('content-length')
  headers.set('cache-control', 'private, no-store')
  if (options.app) {
    headers.set(
      'content-security-policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; media-src 'self' data: blob:",
    )
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export class SpaceRuntimeConfigurationError extends Error {
  constructor() {
    super('SPACE_RUNTIME_ORIGIN and SPACE_RUNTIME_INTERNAL_TOKEN are required')
    this.name = 'SpaceRuntimeConfigurationError'
  }
}
