function upstreamUrl(request: Request) {
  const incoming = new URL(request.url)
  const backend = new URL(process.env.BACKEND_ORIGIN || 'http://localhost:8002')
  backend.pathname = incoming.pathname
  backend.search = incoming.search
  return backend
}

/**
 * Thin same-origin gateway for the product host.
 * Business handlers live exclusively in `apps/backend`.
 */
export async function proxyBackendRequest(request: Request) {
  const incoming = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  const method = request.method.toUpperCase()
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await request.arrayBuffer()

  return fetch(upstreamUrl(request), {
    method,
    headers,
    body,
    redirect: 'manual',
  })
}
