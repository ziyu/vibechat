import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

interface BackendSession {
  user?: {
    id: string
    role?: string | null
  } | null
}

async function fetchFromBackend(path: string) {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const origin = process.env.BACKEND_ORIGIN || new URL(request.url).origin
  return fetch(new URL(path, origin), {
    headers: new Headers(request.headers),
    redirect: 'manual',
  })
}

/**
 * Server function to get the current user's session.
 * Works both during SSR and client-side navigation (via RPC).
 */
const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const response = await fetchFromBackend('/api/auth/get-session')
    if (!response.ok) return { user: null }
    const session = await response.json() as BackendSession | null
    return {
      user: session?.user
        ? { id: session.user.id, role: session.user.role }
        : null,
    }
  } catch (error) {
    console.error('[auth-guard] getAuthSession failed:', error)
    return { user: null }
  }
})

const getSubscriptionAccess = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const response = await fetchFromBackend('/api/subscription/status')
    if (!response.ok) return { hasSubscription: false, isLifetime: false }
    const status = await response.json() as { hasSubscription?: boolean; isLifetime?: boolean }
    return {
      hasSubscription: Boolean(status.hasSubscription),
      isLifetime: Boolean(status.isLifetime),
    }
  } catch (error) {
    console.error('[auth-guard] subscription lookup failed:', error)
    return { hasSubscription: false, isLifetime: false }
  }
})

/**
 * Redirect authenticated users away from auth pages (signin, signup, etc.)
 * to the chat product. Use in `beforeLoad` of auth routes.
 */
export async function redirectIfAuthenticated({
  params,
}: {
  params: { lang: string }
}) {
  const result = await getAuthSession()
  if (result?.user) {
    throw redirect({
      to: '/$lang/messages',
      params: { lang: params.lang },
    })
  }
}

/**
 * Require authentication. Redirects to signin if no session.
 * Use in `beforeLoad` of protected routes.
 */
export async function requireAuth({
  params,
}: {
  params: { lang: string }
}) {
  const result = await getAuthSession()
  const user = result?.user
  if (!user) {
    throw redirect({
      to: '/$lang/signin',
      params: { lang: params.lang },
    })
  }
  return { user }
}

/** Require an active subscription or lifetime entitlement for premium pages. */
export async function requireSubscription({ params }: { params: { lang: string } }) {
  const authResult = await getAuthSession()
  if (!authResult?.user) {
    throw redirect({ to: '/$lang/signin', params: { lang: params.lang } })
  }
  const status = await getSubscriptionAccess()
  if (status.hasSubscription || status.isLifetime) return { user: authResult.user }
  throw redirect({ to: '/$lang/services', params: { lang: params.lang } })
}
