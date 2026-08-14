import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(product)/pricing')({
  beforeLoad: () => { throw redirect({ to: '/services' }) },
})
