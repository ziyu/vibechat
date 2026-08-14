import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth-guard'
import { OnboardingPage } from '@/features/chat/onboarding-page'
import '@/features/chat/onboarding.css'

export const Route = createFileRoute('/$lang/onboarding')({
  beforeLoad: async ({ params }) => {
    await requireAuth({ params: params as { lang: string } })
  },
  component: OnboardingPage,
})
