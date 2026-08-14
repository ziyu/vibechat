import { createFileRoute, redirect } from '@tanstack/react-router'
import { config } from '@config'

export const Route = createFileRoute('/payment-cancel')({
  beforeLoad: ({ location }) => {
    throw redirect({ to: '/$lang/payment-cancel', params: { lang: config.app.i18n.defaultLocale }, search: location.search })
  },
})
