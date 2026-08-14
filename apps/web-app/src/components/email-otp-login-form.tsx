import { useEffect, useState, type FormEvent } from 'react'
import { authClientReact } from '@vibechat/auth-client'
import { cn } from '@vibechat/ui/utils/cn'
import { Button } from '@vibechat/react-shared/ui/button'
import { Input } from '@vibechat/react-shared/ui/input'
import { Label } from '@vibechat/react-shared/ui/label'
import { FormError } from '@vibechat/react-shared/ui/form-error'
import { Turnstile } from '@vibechat/react-shared/ui/turnstile'
import { useTranslation } from '@/hooks/use-translation'
import { config } from '@config'
import { postAuthPath } from '@/lib/auth-return'

type Step = 'email' | 'code'

export function EmailOtpLoginForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { t, locale } = useTranslation()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => setHydrated(true), [])

  const resetCaptcha = () => {
    if (!config.captcha.enabled) return
    setTurnstileToken(null)
    setTurnstileKey((current) => current + 1)
  }

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (config.captcha.enabled && !turnstileToken) {
      setErrorMessage(t.auth.signin.errors.captchaRequired)
      return
    }

    setLoading(true)
    setErrorMessage('')
    setErrorCode('')

    const { data, error } = await authClientReact.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
      ...(config.captcha.enabled && turnstileToken
        ? {
            fetchOptions: {
              headers: { 'x-captcha-response': turnstileToken },
            },
          }
        : {}),
    })

    if (error) {
      setErrorCode(error.code || 'OTP_SEND_FAILED')
      setErrorMessage(
        (error.code &&
          t.auth.authErrors[
            error.code as keyof typeof t.auth.authErrors
          ]) ||
          t.auth.signin.errors.otpSendFailed,
      )
      resetCaptcha()
    } else {
      setStep('code')
      const developmentOtp = (
        data as { dev?: { otpCode?: string } } | null
      )?.dev?.otpCode
      setOtp(developmentOtp?.match(/^\d{6}$/) ? developmentOtp : '')
    }

    setLoading(false)
  }

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setErrorCode('')

    const { error } = await authClientReact.signIn.emailOtp({
      email: email.trim(),
      otp: otp.trim(),
    })

    if (error) {
      setErrorCode(error.code || 'INVALID_OTP')
      setErrorMessage(
        (error.code &&
          t.auth.authErrors[
            error.code as keyof typeof t.auth.authErrors
          ]) ||
          t.auth.signin.errors.invalidOtp,
      )
      setLoading(false)
      return
    }

    window.location.assign(postAuthPath(window.location.search))
  }

  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      <FormError message={errorMessage} code={errorCode} userEmail={email} />

      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4" data-testid="email-otp-request-form">
          <p className="text-muted-foreground text-sm">
            {t.auth.signin.otpDescription}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="otp-email">{t.auth.signin.email}</Label>
            <Input
              id="otp-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.auth.signin.emailPlaceholder}
              autoComplete="email"
              required
              disabled={!hydrated}
            />
          </div>

          <Turnstile
            enabled={config.captcha.enabled}
            siteKey={config.captcha.cloudflare.siteKey}
            key={turnstileKey}
            onSuccess={(token: string) => setTurnstileToken(token)}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={!hydrated || loading || (config.captcha.enabled && !turnstileToken)}
          >
            {loading ? t.auth.signin.sendingOtp : t.auth.signin.sendOtp}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-4" data-testid="email-otp-verify-form">
          <p className="text-muted-foreground text-sm">
            {t.auth.signin.otpSent.replace('{{email}}', email)}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="otp-code">{t.auth.signin.otpCode}</Label>
            <Input
              id="otp-code"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              placeholder={t.auth.signin.otpCodePlaceholder}
              autoComplete="one-time-code"
              required
              autoFocus
              disabled={!hydrated}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!hydrated || loading || otp.length !== 6}>
            {loading ? t.auth.signin.verifyingOtp : t.auth.signin.verifyOtp}
          </Button>
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hydrated}
              onClick={() => setStep('email')}
            >
              {t.auth.signin.changeEmail}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hydrated}
              onClick={() => {
                setStep('email')
                resetCaptcha()
              }}
            >
              {t.auth.signin.resendOtp}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
