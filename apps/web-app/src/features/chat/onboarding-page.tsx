'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Camera, Check, MessageCircle, UsersRound } from 'lucide-react'
import type { ProductProfileResponse } from '@vibechat/api-contracts'
import { ProductApiClient, ProductApiClientError } from '@vibechat/product-client'
import { browserProductPlatform } from '@/lib/product-platform'
import { useTranslation } from '@/hooks/use-translation'

const AVATAR_MAX_BYTES = 5 * 1024 * 1024
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const productApi = new ProductApiClient()

export function OnboardingPage() {
  const { t, locale } = useTranslation()
  const [profile, setProfile] = useState<ProductProfileResponse | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const avatarPreview = useMemo(
    () => avatarFile ? URL.createObjectURL(avatarFile) : profile?.avatarUrl || null,
    [avatarFile, profile?.avatarUrl],
  )

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  useEffect(() => {
    let disposed = false
    void productApi.getProfile()
      .then((nextProfile) => {
        if (disposed) return
        if (nextProfile.onboardingCompleted) {
          browserProductPlatform.navigation.openSpaces(locale)
          return
        }
        setProfile(nextProfile)
        setDisplayName(nextProfile.displayName)
        setUsername(nextProfile.username)
      })
      .catch(() => {
        if (!disposed) setError(t.chatApp.onboarding.loadFailed)
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => { disposed = true }
  }, [locale, t.chatApp.onboarding.loadFailed])

  const selectAvatar = (file?: File) => {
    setError('')
    if (!file) return
    if (!AVATAR_TYPES.has(file.type) || file.size > AVATAR_MAX_BYTES) {
      setError(t.chatApp.onboarding.avatarInvalid)
      return
    }
    setAvatarFile(file)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      let avatarUrl = profile?.avatarUrl || null
      if (avatarFile) {
        const upload = await productApi.uploadImage(avatarFile)
        avatarUrl = upload.url
      }

      await productApi.updateProfile({
        displayName,
        username,
        avatarUrl,
        completeOnboarding: true,
      })
      browserProductPlatform.navigation.openSpaces(locale)
    } catch (cause) {
      const code = cause instanceof ProductApiClientError
        ? cause.code
        : cause instanceof Error ? cause.message : 'PROFILE_UPDATE_FAILED'
      setError(code === 'PROFILE_USERNAME_TAKEN'
        ? t.chatApp.onboarding.usernameTaken
        : code === 'AVATAR_UPLOAD_FAILED'
          ? t.chatApp.onboarding.avatarUploadFailed
          : t.chatApp.onboarding.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="vc-onboarding" data-testid="onboarding-page">
      <aside className="vc-onboarding-story">
        <a href={`/${locale}`} className="vc-onboarding-mark" aria-label="Vibe Chat">V</a>
        <div>
          <span className="vc-kicker">{t.chatApp.onboarding.kicker}</span>
          <h1>{t.chatApp.onboarding.storyTitle}</h1>
          <p>{t.chatApp.onboarding.storyDescription}</p>
        </div>
        <ol>
          <li><UsersRound /><span><strong>{t.chatApp.onboarding.pickPeople}</strong><small>{t.chatApp.onboarding.pickPeopleDescription}</small></span></li>
          <li><MessageCircle /><span><strong>{t.chatApp.onboarding.setAtmosphere}</strong><small>{t.chatApp.onboarding.setAtmosphereDescription}</small></span></li>
          <li><Check /><span><strong>{t.chatApp.onboarding.keepControl}</strong><small>{t.chatApp.onboarding.keepControlDescription}</small></span></li>
        </ol>
      </aside>

      <section className="vc-onboarding-form-panel">
        <form onSubmit={submit} data-testid="onboarding-form">
          <header>
            <span>{t.chatApp.onboarding.step}</span>
            <h2>{t.chatApp.onboarding.title}</h2>
            <p>{t.chatApp.onboarding.description}</p>
          </header>

          <label className="vc-avatar-picker">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              data-testid="onboarding-avatar"
              onChange={(event) => selectAvatar(event.target.files?.[0])}
            />
            <span className="vc-avatar-preview">
              {avatarPreview
                ? <img src={avatarPreview} alt="" />
                : displayName.slice(0, 2).toUpperCase()}
              <i><Camera /></i>
            </span>
            <span><strong>{t.chatApp.onboarding.avatar}</strong><small>{t.chatApp.onboarding.avatarHelp}</small></span>
          </label>
          {avatarFile ? (
            <button type="button" className="vc-onboarding-skip" onClick={() => setAvatarFile(null)}>
              {t.chatApp.onboarding.skipAvatar}
            </button>
          ) : null}

          <label className="vc-onboarding-field">
            <span>{t.chatApp.onboarding.displayName}</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={1}
              maxLength={50}
              required
              autoComplete="name"
              data-testid="profile-display-name"
              disabled={loading || saving}
            />
            <small>{t.chatApp.onboarding.displayNameHelp}</small>
          </label>

          <label className="vc-onboarding-field">
            <span>{t.chatApp.onboarding.username}</span>
            <div><i>@</i><input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9_]+"
              required
              autoComplete="username"
              data-testid="profile-username"
              disabled={loading || saving}
            /></div>
            <small>{t.chatApp.onboarding.usernameHelp}</small>
          </label>

          {error ? <p className="vc-onboarding-error" role="alert">{error}</p> : null}

          <button
            type="submit"
            className="vc-onboarding-submit"
            disabled={loading || saving || !displayName.trim() || username.length < 3}
            data-testid="complete-onboarding"
          >
            {saving ? t.chatApp.onboarding.saving : t.chatApp.onboarding.continue}
            <ArrowRight />
          </button>
          <p className="vc-onboarding-footnote">{t.chatApp.onboarding.privacyNote}</p>
        </form>
      </section>
    </main>
  )
}
