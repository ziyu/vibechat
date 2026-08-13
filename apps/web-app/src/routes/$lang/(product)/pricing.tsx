import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/(product)/pricing')({
  beforeLoad: ({ params }) => { throw redirect({ to: '/$lang/services', params: { lang: params.lang } }) },
})
