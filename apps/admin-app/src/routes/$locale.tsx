import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { isValidLocale } from '@vibechat/i18n'
import { setLocalePreference } from '@/lib/locale.functions'

export const Route = createFileRoute('/$locale')({
  beforeLoad: async ({ params, location }) => {
    if (!isValidLocale(params.locale)) throw notFound()
    await setLocalePreference({ data: params.locale })

    const legacyPrefix = `/${params.locale}`
    const legacyUrl = new URL(location.href, 'https://vibechat.invalid')
    const pathname = legacyUrl.pathname.slice(legacyPrefix.length) || '/admin'
    throw redirect({
      href: `${pathname}${legacyUrl.search}${legacyUrl.hash}`,
      statusCode: 307,
    })
  },
})
