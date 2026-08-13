import { createFileRoute } from '@tanstack/react-router'
import { AiChatPage } from '@/features/ai/ai-chat-page'

export const Route = createFileRoute('/$lang/(product)/ai')({ component: AiChatPage })
