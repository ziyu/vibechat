type TrustedOriginEnvironment = Record<string, string | undefined> & {
  APP_BASE_URL?: string
  BETTER_AUTH_URL?: string
  ADMIN_APP_ORIGIN?: string
  NODE_ENV?: string
}

const LOCAL_ADMIN_ORIGINS = [
  'http://localhost:8005',
  'http://127.0.0.1:8005',
] as const

function localOrigin(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      ? url.origin
      : null
  } catch {
    return null
  }
}

export function getTrustedAuthOrigins(
  request?: Request,
  environment: TrustedOriginEnvironment = process.env,
) {
  const isDevelopment = environment.NODE_ENV !== 'production'
  const origins = [
    environment.APP_BASE_URL,
    environment.BETTER_AUTH_URL,
    environment.ADMIN_APP_ORIGIN,
    ...(isDevelopment ? LOCAL_ADMIN_ORIGINS : []),
  ].filter((origin): origin is string => !!origin)

  if (isDevelopment && request) {
    const requestOrigin = localOrigin(request.url)
    const headerOrigin = localOrigin(request.headers.get('origin'))
    if (requestOrigin) origins.push(requestOrigin)
    if (headerOrigin) origins.push(headerOrigin)
  }

  return [...new Set(origins)]
}
