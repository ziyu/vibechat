import { createFileRoute } from '@tanstack/react-router'
import { DiscoverPage } from '@/features/chat/discover-page'

export const Route = createFileRoute('/(chat)/discover/')({
  component: DiscoverPage,
})
