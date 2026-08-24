import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(chat)/messages')({
  beforeLoad: () => {
    throw redirect({ to: '/spaces' })
  },
})
