import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { config } from '@config'
import { isValidLocale } from '@vibechat/i18n'
import { SharedAppProvider } from '@vibechat/react-shared/providers/app-context'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/$lang')({
  params: {
    parse: (params) => {
      // `/api/$` is intentionally a splat gateway route. Without excluding the
      // reserved `api` segment here, a longer page route such as
      // `/$lang/admin/users` wins route ranking for `/api/admin/users` and the
      // locale guard redirects the API request to the Admin dashboard.
      if (params.lang.toLowerCase() === 'api') {
        throw new Error('The api path segment is reserved')
      }

      return params
    },
  },
  skipRouteOnParseError: { params: true },
  beforeLoad: ({ params }) => {
    if (!isValidLocale(params.lang)) {
      throw redirect({
        to: '/$lang/admin',
        params: { lang: config.app.i18n.defaultLocale },
      })
    }
  },
  component: LangLayout,
})

function LangLayout() {
  const { t, locale } = useTranslation()
  return (
    <SharedAppProvider value={{ t, locale }}>
      <Outlet />
    </SharedAppProvider>
  )
}
