import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ChatDemoProvider } from '@/features/chat/chat-store'
import { ChatShell } from '@/features/chat/chat-shell'
import { useTranslation } from '@/hooks/use-translation'
import '@/features/chat/chat.css'

export const Route = createFileRoute('/$lang/(chat)')({
  component: ChatAppLayout,
})

function ChatAppLayout() {
  const { locale } = useTranslation()

  return (
    <ChatDemoProvider locale={locale}>
      <ChatShell>
        <Outlet />
      </ChatShell>
    </ChatDemoProvider>
  )
}

