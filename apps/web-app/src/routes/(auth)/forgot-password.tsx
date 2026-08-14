import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { seoHead } from '@/lib/seo'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vibechat/react-shared/ui/card'
import { Button } from '@vibechat/react-shared/ui/button'
import { Input } from '@vibechat/react-shared/ui/input'
import { Label } from '@vibechat/react-shared/ui/label'
import { FormError } from '@vibechat/react-shared/ui/form-error'
import { Turnstile } from '@vibechat/react-shared/ui/turnstile'
import { Loader2 } from 'lucide-react'
import { createValidators } from '@vibechat/validators'
import { authClientReact } from '@vibechat/auth-client'
import type { z } from 'zod'
import { useTranslation } from '@/hooks/use-translation'
import { config } from '@config'

export const Route = createFileRoute('/(auth)/forgot-password')({
  head: ({ match }) => seoHead(match.context.locale, (t) => t.auth.metadata.forgotPassword),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { t, locale, tWithParams } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{
    code?: string
    message: string
  } | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)

  const { forgetPasswordSchema } = createValidators(tWithParams)

  type FormData = z.infer<typeof forgetPasswordSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  })

  const onSubmit = async (data: FormData) => {
    if (config.captcha.enabled && !turnstileToken) {
      setError({
        code: 'CAPTCHA_REQUIRED',
        message: t.auth.forgetPassword.errors.captchaRequired,
      })
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await authClientReact.requestPasswordReset({
      email: data.email,
      redirectTo: '/reset-password',
      fetchOptions: {
        headers: {
          'X-Locale': locale,
          ...(config.captcha.enabled && turnstileToken
            ? { 'x-captcha-response': turnstileToken }
            : {}),
        },
      },
    })

    if (error) {
      setError({
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || t.common.unexpectedError,
      })
      if (config.captcha.enabled) {
        setTurnstileToken(null)
        setTurnstileKey((prev) => prev + 1)
      }
      setLoading(false)
      return
    }

    setEmailSent(true)
    setSentEmail(data.email)
    setLoading(false)
  }

  return (
    <Card className="w-[380px]">
      {!emailSent ? (
        <>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {t.auth.forgetPassword.title}
            </CardTitle>
            <CardDescription>
              {t.auth.forgetPassword.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">
                    {t.auth.forgetPassword.email}
                  </Label>
                  <Input
                    id="email"
                    placeholder={t.auth.forgetPassword.emailPlaceholder}
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading}
                    {...register('email')}
                  />
                  {errors?.email && (
                    <p className="px-1 text-xs text-red-600">
                      {errors.email.message}
                    </p>
                  )}
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
                  disabled={
                    loading ||
                    (config.captcha.enabled && !turnstileToken)
                  }
                >
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {loading
                    ? t.auth.forgetPassword.submitting
                    : t.auth.forgetPassword.submit}
                </Button>
              </div>
            </form>
            {error && (
              <FormError message={error.message} code={error.code} />
            )}
            <div className="text-muted-foreground *:[a]:hover:text-primary text-balance text-center text-xs *:[a]:underline *:[a]:underline-offset-4">
              {t.auth.forgetPassword.termsNotice}{' '}
              <a href="#">{t.auth.forgetPassword.termsOfService}</a>{' '}
              {t.common.and}{' '}
              <a href="#">{t.auth.forgetPassword.privacyPolicy}</a>.
            </div>
          </CardContent>
        </>
      ) : (
        <div className="space-y-4 text-center p-6">
          <h3 className="font-medium">
            {t.auth.forgetPassword.verification.title}
          </h3>
          <p className="text-muted-foreground">
            {t.auth.forgetPassword.verification.sent}{' '}
            <span className="font-medium">{sentEmail}</span>
          </p>
          <p className="text-muted-foreground text-sm">
            {t.auth.forgetPassword.verification.checkSpam}
          </p>
        </div>
      )}
    </Card>
  )
}
