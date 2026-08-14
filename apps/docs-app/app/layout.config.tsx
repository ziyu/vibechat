import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { i18n } from '@/lib/i18n';
import { Logo } from '@/components/ui/logo';
import { translations } from '@vibechat/i18n';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(locale: string): BaseLayoutProps {
  const t = translations[locale as keyof typeof translations] || translations.en;

  return {
    // Locale state is already provided by DocsRootProvider. Passing Fumadocs'
    // server i18n API here would serialize its translations() function into a
    // client layout on static export.
    i18n: true,
    nav: {
      title: <Logo size="md" />,
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [
      {
        text: t.docs.nav.docs,
        url: `/${locale}/docs`,
      },
      {
        text: t.docs.nav.blog,
        url: `/${locale}/blog`,
      },
    ],
  };
}
