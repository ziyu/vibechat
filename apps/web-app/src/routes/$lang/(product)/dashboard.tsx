import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/(product)/dashboard')({
  beforeLoad: ({ params }) => { throw redirect({ to: '/$lang/account', params: { lang: params.lang } }) },
})
