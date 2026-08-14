import { createFileRoute } from '@tanstack/react-router'
import { seoHead } from '@/lib/seo'
import { LoginForm } from '@/components/login-form'
import { EmailOtpLoginForm } from '@/components/email-otp-login-form'
import { SocialAuth } from '@/components/social-auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vibechat/react-shared/ui/card'
import { useTranslation } from '@/hooks/use-translation'
import { Button } from '@vibechat/react-shared/ui/button'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/(auth)/signin')({
  head: ({ match }) => seoHead(match.context.locale, (t) => t.auth.metadata.signin),
  component: SigninPage,
})

function SigninPage() {
  const { t } = useTranslation()
  const [method, setMethod] = useState<'otp' | 'password'>('otp')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => setHydrated(true), [])

  return (
    <Card
      className="w-[380px]"
      data-testid="signin-card"
      data-ready={hydrated ? 'true' : 'false'}
    >
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t.auth.signin.welcomeBack}</CardTitle>
        <CardDescription>{t.auth.signin.socialLogin}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SocialAuth />
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-card text-muted-foreground relative z-10 px-2">
            {t.auth.signin.continueWith}
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {method === 'otp' ? <EmailOtpLoginForm /> : <LoginForm />}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={!hydrated}
            onClick={() => setMethod((current) => current === 'otp' ? 'password' : 'otp')}
          >
            {method === 'otp'
              ? t.auth.signin.usePasswordInstead
              : t.auth.signin.useEmailOtpInstead}
          </Button>
        </div>
        <div className="text-muted-foreground *:[a]:hover:text-primary text-balance text-center text-xs *:[a]:underline *:[a]:underline-offset-4">
          {t.auth.signin.termsNotice}{' '}
          <a href="#">{t.auth.signin.termsOfService}</a>{' '}
          {t.common.and} <a href="#">{t.auth.signin.privacyPolicy}</a>.
        </div>
      </CardContent>
    </Card>
  )
}
