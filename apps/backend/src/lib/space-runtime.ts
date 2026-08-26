import { DatabaseRoomRepository } from '@libs/rooms'
import type { SpaceInstanceRecord } from '@libs/rooms/types'
import {
  signSpaceRuntimeCredential,
  spaceRuntimeAudience,
} from '@vibechat/space-runtime-auth'
import { verifyLiveMatrixMembership } from './matrix-membership'
import { injectSpaceAppSdk } from './space-app-html'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from './product-api'

export async function authorizeSpaceRuntimeRequest(request: Request, matrixRoomId: string) {
  const requestId = productRequestId(request)
  const auth = await requireProductSession(request, requestId)
  if (!auth.ok) return auth
  const instance = await new DatabaseRoomRepository().getByMatrixRoomId(matrixRoomId)
  const isMember = instance
    ? await verifyLiveMatrixMembership({
        userId: auth.session.user.id,
        matrixRoomId,
      }).catch(() => false)
    : false
  if (!instance || !isMember) {
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
  const secret = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
  if (!origin || !secret) throw new SpaceRuntimeConfigurationError()
  const target = new URL(path, origin)
  const method = (init.method || 'GET').toUpperCase()
  const credential = await signSpaceRuntimeCredential({
    secret,
    audience: spaceRuntimeAudience,
    subject: 'vibechat-backend',
    method,
    path: target.pathname,
    ttlSeconds: 60,
  })
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${credential}`)
  headers.set('accept', headers.get('accept') || 'application/json')
  return fetch(target, { ...init, headers, redirect: 'manual' })
}

export async function ensureSpaceTemplateProject(
  instance: Pick<
    SpaceInstanceRecord,
    'spaceInstanceId' | 'spaceId' | 'spaceVersionId'
  >,
) {
  const response = await fetchSpaceRuntime(
    `/api/apps/${encodeURIComponent(instance.spaceInstanceId)}/bootstrap`,
    runtimeJsonInit({
      templateId: instance.spaceId,
      templateVersionId: instance.spaceVersionId,
    }),
  )
  if (!response.ok) {
    throw new Error(`Space template bootstrap failed with ${response.status}`)
  }
  return response
}

export function runtimeJsonInit(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  }
}

export function proxySpaceRuntimeResponse(response: Response) {
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  headers.delete('content-length')
  headers.set('cache-control', 'private, no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function proxySpaceRuntimeAppResponse(response: Response) {
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  headers.delete('content-length')
  headers.set('cache-control', 'private, no-store')
  headers.set(
    'content-security-policy',
    "default-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src data:; connect-src 'none'; media-src 'self' data: blob:",
  )
  const contentType = headers.get('content-type') || ''
  const body = response.ok && contentType.includes('text/html')
    ? injectSpaceAppSdk(await response.text())
    : response.body
  return new Response(body, {
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
