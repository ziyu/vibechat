import { createFileRoute } from '@tanstack/react-router'
import { PremiumFeaturesPage } from '@/features/account/premium-features-page'
import { requireSubscription } from '@/lib/auth-guard'

export const Route = createFileRoute('/$lang/(product)/premium-features')({
  beforeLoad: requireSubscription,
  component: PremiumFeaturesPage,
})
