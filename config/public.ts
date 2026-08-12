function getVitePublicEnv(key: string): string | undefined {
  const viteEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env
  return viteEnv?.[key]
}

/**
 * Browser-safe configuration shared by the site and product hosts.
 * Server credentials and provider configuration must stay in `config.ts`.
 */
export const publicConfig = {
  app: {
    name: 'Vibe Chat',
    logo: {
      iconUrl: '/logo.svg',
      fullLogoUrl: '' as string | undefined,
      iconClassName: 'rounded-xl shadow-sm' as string,
    },
    theme: {
      defaultTheme: 'light' as const,
      defaultColorScheme: 'modern-minimal' as const,
      storageKey: 'vibechat-ui-theme',
    },
    i18n: {
      defaultLocale: 'zh-CN' as const,
      locales: ['en', 'zh-CN'] as const,
      cookieKey: 'VIBECHAT_LOCALE',
      autoDetect: false,
    },
  },
  auth: {
    requireEmailVerification: false,
  },
  captcha: {
    enabled: false,
    cloudflare: {
      get siteKey() {
        return getVitePublicEnv('VITE_TURNSTILE_SITE_KEY')
          || '1x00000000000000000000AA'
      },
    },
  },
} as const

export { publicConfig as config }
