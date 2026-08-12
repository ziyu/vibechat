export function postAuthPath(locale: string, search: string) {
  const returnTo = new URLSearchParams(search).get('returnTo')
  return returnTo?.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : `/${locale}/onboarding`
}
