import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/(root)/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$lang/messages',
      params: { lang: params.lang },
    })
  },
})
