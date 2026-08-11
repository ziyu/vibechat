'use client'

import { useState } from 'react'
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Database,
  Languages,
  Laptop,
  LockKeyhole,
  MoonStar,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'
import { useTheme } from '@libs/react-shared/hooks/use-theme'
import type { SupportedLocale } from '@libs/i18n'
import { useTranslation } from '@/hooks/use-translation'
import { useChatDemo } from './chat-store'
import { PersonAvatar } from './chat-primitives'

export function MePage() {
  const { t, locale, changeLocale } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { state, resetDemo } = useChatDemo()
  const [notifications, setNotifications] = useState(true)
  const currentUser = state.people.find((person) => person.id === state.currentUserId)!

  return (
    <section className="vc-me-page" data-testid="me-page">
      <header className="vc-me-header">
        <span className="vc-kicker">{t.chatApp.me.kicker}</span>
        <h1>{t.chatApp.me.title}</h1>
        <p>{t.chatApp.me.description}</p>
      </header>

      <div className="vc-me-grid">
        <section className="vc-profile-card">
          <div className="vc-profile-wash" aria-hidden="true" />
          <PersonAvatar person={currentUser} size="xl" showPresence />
          <span>
            <small>{t.chatApp.me.profile}</small>
            <h2>{currentUser.displayName}</h2>
            <p>{currentUser.handle}</p>
          </span>
          <blockquote>{currentUser.bio}</blockquote>
          <div className="vc-profile-stats">
            <span>
              <strong>{state.rooms.length}</strong>
              <small>{t.chatApp.me.rooms}</small>
            </span>
            <span>
              <strong>{state.contactIds.length}</strong>
              <small>{t.chatApp.me.contacts}</small>
            </span>
            <span>
              <strong>{state.favoriteSpaceIds.length}</strong>
              <small>{t.chatApp.me.savedSpaces}</small>
            </span>
          </div>
        </section>

        <div className="vc-settings-stack">
          <SettingsGroup title={t.chatApp.me.preferences}>
            <SettingsRow icon={<Bell />} title={t.chatApp.me.notifications} description={t.chatApp.me.notificationsDescription}>
              <button
                type="button"
                className="vc-switch"
                data-checked={notifications || undefined}
                aria-pressed={notifications}
                onClick={() => setNotifications((current) => !current)}
              >
                <span />
              </button>
            </SettingsRow>
            <SettingsRow icon={<MoonStar />} title={t.chatApp.me.appearance} description={t.chatApp.me.appearanceDescription}>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as typeof theme)}
                aria-label={t.chatApp.me.appearance}
              >
                <option value="light">{t.common.theme.light}</option>
                <option value="dark">{t.common.theme.dark}</option>
                <option value="system">{t.common.theme.system}</option>
              </select>
            </SettingsRow>
            <SettingsRow icon={<Languages />} title={t.chatApp.me.language} description={t.chatApp.me.languageDescription}>
              <select
                value={locale}
                onChange={(event) => changeLocale(event.target.value as SupportedLocale)}
                aria-label={t.chatApp.me.language}
              >
                <option value="zh-CN">中文</option>
                <option value="en">English</option>
              </select>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t.chatApp.me.securityAndData}>
            <SettingsRow icon={<Laptop />} title={t.chatApp.me.devices} description={t.chatApp.me.devicesDescription}>
              <ChevronRight />
            </SettingsRow>
            <SettingsRow icon={<LockKeyhole />} title={t.chatApp.me.privacy} description={t.chatApp.me.privacyDescription}>
              <ChevronRight />
            </SettingsRow>
            <SettingsRow icon={<Database />} title={t.chatApp.me.localData} description={t.chatApp.me.localDataDescription}>
              <button type="button" className="vc-reset-button" onClick={resetDemo}>
                <RefreshCcw size={14} />
                {t.chatApp.me.resetDemo}
              </button>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t.chatApp.me.about}>
            <SettingsRow icon={<ShieldCheck />} title={t.chatApp.me.hostSafety} description={t.chatApp.me.hostSafetyDescription}>
              <ChevronRight />
            </SettingsRow>
            <SettingsRow icon={<CircleHelp />} title={t.chatApp.me.help} description={t.chatApp.me.helpDescription}>
              <ChevronRight />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </div>
    </section>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="vc-settings-group">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function SettingsRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="vc-settings-row">
      <span className="vc-settings-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <div>{children}</div>
    </div>
  )
}

