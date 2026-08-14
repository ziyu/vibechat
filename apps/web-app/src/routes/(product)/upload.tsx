import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(product)/upload')({
  beforeLoad: () => { throw redirect({ to: '/services' }) },
})
