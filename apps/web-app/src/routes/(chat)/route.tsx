import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ChatProvider } from '@/features/chat/chat-store'
import { ChatShell } from '@/features/chat/chat-shell'
import { useTranslation } from '@/hooks/use-translation'
import { requireAuth } from '@/lib/auth-guard'
import '@/features/chat/chat.css'

export const Route = createFileRoute('/(chat)')({
  beforeLoad: requireAuth,
  component: ChatAppLayout,
})

function ChatAppLayout() {
  const { locale } = useTranslation()

  return (
    <ChatProvider locale={locale}>
      <ChatShell>
        <Outlet />
      </ChatShell>
    </ChatProvider>
  )
}
