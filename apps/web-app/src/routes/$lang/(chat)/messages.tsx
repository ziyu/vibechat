import { createFileRoute } from '@tanstack/react-router'
import { MessagesPage } from '@/features/chat/messages-page'

export const Route = createFileRoute('/$lang/(chat)/messages')({
  component: MessagesPage,
})

