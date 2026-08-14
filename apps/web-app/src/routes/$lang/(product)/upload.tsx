import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/(product)/upload')({
  beforeLoad: ({ params }) => { throw redirect({ to: '/$lang/services', params: { lang: params.lang } }) },
})
