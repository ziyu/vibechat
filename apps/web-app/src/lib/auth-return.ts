export function postAuthPath(locale: string, search: string) {
  const returnTo = new URLSearchParams(search).get('returnTo')
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) return returnTo

  if (returnTo) {
    try {
      const target = new URL(returnTo)
      const adminOrigin = (
        import.meta.env.VITE_ADMIN_APP_ORIGIN || 'http://localhost:8005'
      ).replace(/\/$/, '')
      const isAdminRoute = /^\/(en|zh-CN)\/admin(?:\/|$)/.test(target.pathname)
      if (target.origin === adminOrigin && isAdminRoute) return target.toString()
    } catch {
      // Invalid external return targets fall through to the product default.
    }
  }

  return `/${locale}/onboarding`
}
