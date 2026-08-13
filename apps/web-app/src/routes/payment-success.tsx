import { createFileRoute, redirect } from '@tanstack/react-router'
import { config } from '@config'

export const Route = createFileRoute('/payment-success')({
  beforeLoad: ({ location }) => {
    throw redirect({ to: '/$lang/payment-success', params: { lang: config.app.i18n.defaultLocale }, search: location.search })
  },
})
