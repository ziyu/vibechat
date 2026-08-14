'use client'

import { BarChart3, Bot, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from '@/hooks/use-translation'

export function PremiumFeaturesPage() {
  const { t, locale } = useTranslation()
  const features = [
    [ShieldCheck, t.premiumFeatures.features.userManagement.title, t.premiumFeatures.features.userManagement.description, '/account'] as const,
    [Bot, t.premiumFeatures.features.aiAssistant.title, t.premiumFeatures.features.aiAssistant.description, '/ai'] as const,
    [FileText, t.premiumFeatures.features.documentProcessing.title, t.premiumFeatures.features.documentProcessing.description, '/services'] as const,
    [BarChart3, t.premiumFeatures.features.dataAnalytics.title, t.premiumFeatures.features.dataAnalytics.description, '/account'] as const,
  ]
  return (
    <section className="vc-premium-page" data-testid="premium-features-page">
      <header><span className="vc-kicker">MEMBERSHIP / ACCESS</span><h1>{t.premiumFeatures.title}</h1><p>{t.premiumFeatures.description}</p><i><Sparkles size={16} />{t.premiumFeatures.subscription.active}</i></header>
      <div>{features.map(([Icon, title, description, to], index) => <article key={title}>
        <small>0{index + 1}</small><Icon size={25} /><h2>{title}</h2><p>{description}</p><Link to={to}>{t.premiumFeatures.actions.accessFeature}</Link>
      </article>)}</div>
    </section>
  )
}
