'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  ChevronRight,
  CircleHelp,
  ContactRound,
  Database,
  Languages,
  Laptop,
  LockKeyhole,
  LogOut,
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
  const { state, mode, resetDemo, unblockUser, clearLocalChatData } = useChatDemo()
  const [notifications, setNotifications] = useState(true)
  const [privacyExpanded, setPrivacyExpanded] = useState(false)
  const [devicesExpanded, setDevicesExpanded] = useState(false)
  const [sessions, setSessions] = useState<AuthBrowserSession[]>([])
  const [currentSessionToken, setCurrentSessionToken] = useState<string>()
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const currentUser = state.people.find((person) => person.id === state.currentUserId)!
  const blockedPeople = state.blockedUserIds
    .map((userId) => state.people.find((person) => person.id === userId))
    .filter((person): person is NonNullable<typeof person> => !!person)

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    setSessionsError(false)
    try {
      const [listResponse, currentResponse] = await Promise.all([
        fetch('/api/auth/list-sessions', { credentials: 'include' }),
        fetch('/api/auth/get-session', { credentials: 'include' }),
      ])
      if (!listResponse.ok || !currentResponse.ok) throw new Error('SESSION_LIST_FAILED')
      const list = await listResponse.json() as AuthBrowserSession[]
      const current = await currentResponse.json() as {
        session?: { token?: string }
      } | null
      setSessions(list)
      setCurrentSessionToken(current?.session?.token)
    } catch {
      setSessionsError(true)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (devicesExpanded) void loadSessions()
  }, [devicesExpanded, loadSessions])

  const revokeSession = async (token: string) => {
    const response = await fetch('/api/auth/revoke-session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!response.ok) {
      setSessionsError(true)
      return
    }
    await loadSessions()
  }

  const revokeOtherSessions = async () => {
    const response = await fetch('/api/auth/revoke-other-sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) {
      setSessionsError(true)
      return
    }
    await loadSessions()
  }

  const signOut = async () => {
    setSigningOut(true)
    await clearLocalChatData().catch(() => undefined)
    const response = await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    if (response.ok) {
      window.location.assign(`/${locale}/signin`)
      return
    }
    setSigningOut(false)
    setSessionsError(true)
  }

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
              <button
                type="button"
                className="vc-settings-action"
                aria-expanded={devicesExpanded}
                onClick={() => setDevicesExpanded((current) => !current)}
                data-testid="manage-sessions"
              >
                {t.chatApp.me.manage}
                <ChevronRight />
              </button>
            </SettingsRow>
            {devicesExpanded ? (
              <section className="vc-session-list" data-testid="session-list">
                <header>
                  <span>{t.chatApp.me.activeSessions.replace('{count}', sessions.length.toString())}</span>
                  {sessions.length > 1 ? (
                    <button type="button" onClick={() => void revokeOtherSessions()}>
                      {t.chatApp.me.revokeOthers}
                    </button>
                  ) : null}
                </header>
                {sessionsLoading ? <p>{t.chatApp.me.loadingSessions}</p> : null}
                {sessionsError ? (
                  <p role="alert">
                    {t.chatApp.me.sessionsFailed}
                    <button type="button" onClick={() => void loadSessions()}>{t.actions.tryAgain}</button>
                  </p>
                ) : null}
                {!sessionsLoading ? sessions.map((session) => {
                  const current = session.token === currentSessionToken
                  return (
                    <article key={session.id} data-testid="browser-session" data-current={current || undefined}>
                      <Laptop size={15} />
                      <span>
                        <strong>{session.userAgent || t.chatApp.me.unknownBrowser}</strong>
                        <small>
                          {new Date(session.createdAt).toLocaleString(locale)}
                          {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                        </small>
                      </span>
                      {current ? (
                        <i>{t.chatApp.me.currentSession}</i>
                      ) : (
                        <button type="button" onClick={() => void revokeSession(session.token)}>
                          {t.chatApp.me.revokeSession}
                        </button>
                      )}
                    </article>
                  )
                }) : null}
              </section>
            ) : null}
            <SettingsRow icon={<LockKeyhole />} title={t.chatApp.me.privacy} description={t.chatApp.me.privacyDescription}>
              <button
                type="button"
                className="vc-settings-action"
                aria-expanded={privacyExpanded}
                onClick={() => setPrivacyExpanded((current) => !current)}
                data-testid="manage-privacy"
              >
                {t.chatApp.me.manage}
                <ChevronRight />
              </button>
            </SettingsRow>
            {privacyExpanded ? (
              <section className="vc-block-list" data-testid="blocked-user-list">
                {blockedPeople.length ? blockedPeople.map((person) => (
                  <article key={person.id} data-testid="blocked-user">
                    <PersonAvatar person={person} size="sm" />
                    <span>
                      <strong>{person.displayName}</strong>
                      <small>{person.handle}</small>
                    </span>
                    <button
                      type="button"
                      className="vc-reset-button"
                      onClick={() => void unblockUser(person.id)}
                    >
                      {t.chatApp.me.unblock}
                    </button>
                  </article>
                )) : (
                  <p>
                    <ContactRound size={15} />
                    {t.chatApp.me.noBlockedUsers}
                  </p>
                )}
              </section>
            ) : null}
            <SettingsRow
              icon={<Database />}
              title={t.chatApp.me.localData}
              description={mode === 'matrix'
                ? t.chatApp.me.matrixDataDescription
                : t.chatApp.me.localDataDescription}
            >
              <button
                type="button"
                className="vc-reset-button"
                onClick={() => {
                  if (mode === 'matrix') {
                    void clearLocalChatData().then(() => window.location.reload())
                  } else {
                    resetDemo()
                  }
                }}
              >
                <RefreshCcw size={14} />
                {mode === 'matrix' ? t.chatApp.me.clearPreferences : t.chatApp.me.resetDemo}
              </button>
            </SettingsRow>
            <SettingsRow icon={<LogOut />} title={t.chatApp.me.signOut} description={t.chatApp.me.signOutDescription}>
              <button
                type="button"
                className="vc-reset-button vc-danger-button"
                disabled={signingOut}
                onClick={() => void signOut()}
                data-testid="chat-sign-out"
              >
                {signingOut ? t.chatApp.me.signingOut : t.chatApp.me.signOut}
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

interface AuthBrowserSession {
  id: string
  token: string
  createdAt: string | Date
  expiresAt: string | Date
  ipAddress?: string | null
  userAgent?: string | null
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
