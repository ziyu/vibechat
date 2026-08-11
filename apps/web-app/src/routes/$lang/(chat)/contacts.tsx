import { createFileRoute } from '@tanstack/react-router'
import { ContactsPage } from '@/features/chat/contacts-page'

export const Route = createFileRoute('/$lang/(chat)/contacts')({
  component: ContactsPage,
})

