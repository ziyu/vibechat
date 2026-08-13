import { createFileRoute, redirect } from '@tanstack/react-router'
import { config } from '@config'

export const Route = createFileRoute('/referral/$code')({
  beforeLoad: ({ params }) => {
    const code = params.code.trim()
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
      throw redirect({ to: '/$lang', params: { lang: config.app.i18n.defaultLocale } })
    }
    throw redirect({
      to: '/$lang/signup',
      params: { lang: config.app.i18n.defaultLocale },
      search: { ref: code },
    })
  },
})
