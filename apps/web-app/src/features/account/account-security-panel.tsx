'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Link2, LoaderCircle, ShieldAlert, Trash2 } from 'lucide-react'
import { authClientReact } from '@vibechat/auth-client'
import { useTranslation } from '@/hooks/use-translation'

interface LinkedAccount {
  id: string
  providerId: string
  createdAt: string | Date
}

export function AccountSecurityPanel({ hasActiveSubscription }: { hasActiveSubscription: boolean }) {
  const { t, locale } = useTranslation()
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState(false)
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' })
  const [passwordState, setPasswordState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState('')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteState, setDeleteState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [deleteError, setDeleteError] = useState('')

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true); setAccountsError(false)
    const result = await authClientReact.listAccounts()
    if (result.error) setAccountsError(true)
    else setAccounts((result.data || []) as LinkedAccount[])
    setAccountsLoading(false)
  }, [])
  useEffect(() => { void loadAccounts() }, [loadAccounts])

  const hasCredentialAccount = useMemo(() => accounts.some((account) => account.providerId === 'credential'), [accounts])
  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordState('loading'); setPasswordError('')
    if (password.next !== password.confirm) {
      setPasswordState('error'); setPasswordError(t.chatApp.account.security.passwordMismatch); return
    }
    const result = await authClientReact.changePassword({
      currentPassword: password.current,
      newPassword: password.next,
      revokeOtherSessions: true,
    })
    if (result.error) {
      setPasswordState('error'); setPasswordError(result.error.message || t.chatApp.account.security.passwordFailed); return
    }
    setPassword({ current: '', next: '', confirm: '' }); setPasswordState('success')
  }

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (deletePhrase !== t.chatApp.account.security.deletePhrase || hasActiveSubscription) return
    setDeleteState('loading'); setDeleteError('')
    const result = await authClientReact.deleteUser({ password: deletePassword || undefined })
    if (result.error) {
      setDeleteState('error')
      setDeleteError(result.error.code === 'ACTIVE_SUBSCRIPTION'
        ? t.chatApp.account.security.activeSubscription
        : result.error.message || t.chatApp.account.security.deleteFailed)
      return
    }
    window.location.assign(`/${locale}`)
  }

  return (
    <div className="vc-security-grid" data-testid="account-security">
      <section className="vc-ledger-card">
        <header><Link2 size={17} /><h2>{t.chatApp.account.security.linkedAccounts}</h2></header>
        {accountsLoading ? <p className="vc-inline-state"><LoaderCircle className="vc-spin" />{t.chatApp.account.loading}</p> : null}
        {accountsError ? <p className="vc-inline-state" role="alert">{t.chatApp.account.loadFailed}<button type="button" onClick={() => void loadAccounts()}>{t.chatApp.account.retry}</button></p> : null}
        {!accountsLoading && !accountsError && !accounts.length ? <p className="vc-empty-record">{t.chatApp.account.security.noLinkedAccounts}</p> : null}
        {accounts.map((account) => <article className="vc-simple-record" key={account.id}>
          <span><strong>{t.dashboard.linkedAccounts.providers[account.providerId as keyof typeof t.dashboard.linkedAccounts.providers] || account.providerId}</strong><small>{t.chatApp.account.security.linkedAt.replace('{date}', new Date(account.createdAt).toLocaleDateString(locale))}</small></span>
          <i data-status="paid">{t.dashboard.linkedAccounts.connected}</i>
        </article>)}
      </section>

      <section className="vc-ledger-card vc-security-form-card">
        <header><KeyRound size={17} /><h2>{t.chatApp.account.security.passwordTitle}</h2></header>
        {!accountsLoading && !hasCredentialAccount ? <p className="vc-empty-record">{t.chatApp.account.security.socialOnly}</p> : (
          <form onSubmit={updatePassword}>
            <label><span>{t.chatApp.account.security.currentPassword}</span><input data-testid="security-current-password" type="password" autoComplete="current-password" value={password.current} required onChange={(event) => setPassword({ ...password, current: event.target.value })} /></label>
            <label><span>{t.chatApp.account.security.newPassword}</span><input data-testid="security-new-password" type="password" autoComplete="new-password" minLength={8} value={password.next} required onChange={(event) => setPassword({ ...password, next: event.target.value })} /></label>
            <label><span>{t.chatApp.account.security.confirmPassword}</span><input data-testid="security-confirm-password" type="password" autoComplete="new-password" minLength={8} value={password.confirm} required onChange={(event) => setPassword({ ...password, confirm: event.target.value })} /></label>
            {passwordState === 'success' ? <p role="status">{t.chatApp.account.security.passwordChanged}</p> : null}
            {passwordState === 'error' ? <p role="alert">{passwordError}</p> : null}
            <button data-testid="security-change-password" type="submit" disabled={passwordState === 'loading'}>{passwordState === 'loading' ? t.chatApp.account.security.changingPassword : t.chatApp.account.security.changePassword}</button>
          </form>
        )}
      </section>

      <section className="vc-ledger-card vc-danger-zone">
        <header><ShieldAlert size={17} /><h2>{t.chatApp.account.security.dangerTitle}</h2></header>
        <p>{t.chatApp.account.security.dangerDescription}</p>
        {hasActiveSubscription ? <p role="alert">{t.chatApp.account.security.activeSubscription}</p> : null}
        <form onSubmit={deleteAccount}>
          <label><span>{t.chatApp.account.security.confirmDelete}</span><input data-testid="security-delete-phrase" value={deletePhrase} autoComplete="off" onChange={(event) => setDeletePhrase(event.target.value)} /></label>
          {hasCredentialAccount ? <label><span>{t.chatApp.account.security.deletePassword}</span><input data-testid="security-delete-password" type="password" autoComplete="current-password" value={deletePassword} required onChange={(event) => setDeletePassword(event.target.value)} /></label> : null}
          {deleteState === 'error' ? <p role="alert">{deleteError}</p> : null}
          <button data-testid="security-delete-account" type="submit" disabled={hasActiveSubscription || deletePhrase !== t.chatApp.account.security.deletePhrase || deleteState === 'loading'}><Trash2 size={14} />{deleteState === 'loading' ? t.chatApp.account.security.deletingAccount : t.chatApp.account.security.deleteAccount}</button>
        </form>
      </section>
    </div>
  )
}
