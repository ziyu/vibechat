import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

interface BackendSession {
  user?: { id: string; role?: string | null } | null
}

async function fetchBackendSession() {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const backend = process.env.BACKEND_ORIGIN || 'http://localhost:8002'
  return fetch(new URL('/api/auth/get-session', backend), {
    headers: new Headers(request.headers),
    redirect: 'manual',
  })
}

const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const response = await fetchBackendSession()
    if (!response.ok) return { user: null }
    const session = await response.json() as BackendSession | null
    return { user: session?.user || null }
  } catch (error) {
    console.error('[admin-auth-guard] session lookup failed:', error)
    return { user: null }
  }
})

export async function requireAdmin({ params }: { params: { lang: string } }) {
  const result = await getAdminSession()
  if (!result.user) {
    throw redirect({
      to: '/$lang/signin',
      params: { lang: params.lang },
    })
  }
  if (result.user.role !== 'admin') {
    throw redirect({
      to: '/$lang/forbidden',
      params: { lang: params.lang },
    })
  }
  return { user: result.user }
}
