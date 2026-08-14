import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(product)/dashboard')({
  beforeLoad: () => { throw redirect({ to: '/account' }) },
})
