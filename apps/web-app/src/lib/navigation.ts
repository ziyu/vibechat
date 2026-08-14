/**
 * Accept only same-origin absolute paths for post-auth navigation.
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const url = new URL(value, 'https://internal.vibechat.invalid')
    if (url.origin !== 'https://internal.vibechat.invalid') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
