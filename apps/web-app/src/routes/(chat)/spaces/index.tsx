import { createFileRoute } from '@tanstack/react-router'
import { SpacesPage } from '@/features/chat/spaces-page'

export const Route = createFileRoute('/(chat)/spaces/')({
  component: SpacesPage,
})
