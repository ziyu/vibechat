import {
  spaceBackendCallbackAudience,
  verifySpaceRuntimeCredential,
} from '@vibechat/space-runtime-auth'

export async function authorizeSpaceRuntimeCallback(request: Request) {
  const secret = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
  const credential = bearerCredential(request.headers.get('authorization'))
  if (!secret || !credential) return false
  const url = new URL(request.url)
  const claims = await verifySpaceRuntimeCredential(credential, {
    secret,
    audience: spaceBackendCallbackAudience,
    subject: 'space-runtime',
    method: request.method,
    path: url.pathname,
  })
  return Boolean(claims)
}

function bearerCredential(value: string | null) {
  if (!value?.startsWith('Bearer ')) return null
  return value.slice('Bearer '.length).trim() || null
}
