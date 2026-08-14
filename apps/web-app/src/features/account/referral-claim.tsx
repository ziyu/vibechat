'use client'

import { useEffect, useRef } from 'react'
import { authClientReact } from '@vibechat/auth-client'

const REFERRAL_COOKIE = 'referral_code'
const MAX_CODE_LENGTH = 64

function cookieValue(name: string) {
  return document.cookie.split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1)
}

/** Captures public referral links and claims them once a user has a session. */
export function ReferralClaim() {
  const attempted = useRef(false)
  const { data: session } = authClientReact.useSession()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')?.trim()
    if (code && /^[A-Za-z0-9_-]+$/.test(code) && code.length <= MAX_CODE_LENGTH) {
      document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
    }
    if (attempted.current || !session?.user?.id || !cookieValue(REFERRAL_COOKIE)) return
    attempted.current = true
    void fetch('/api/affiliate/claim', { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401) { attempted.current = false; return }
        if (!response.ok) throw new Error('Referral claim failed')
      })
      .catch((error) => console.warn('[Affiliate] Referral claim failed:', error))
  }, [session?.user?.id])

  return null
}
