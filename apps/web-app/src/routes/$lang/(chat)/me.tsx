import { createFileRoute } from '@tanstack/react-router'
import { MePage } from '@/features/chat/me-page'

export const Route = createFileRoute('/$lang/(chat)/me')({
  component: MePage,
})

