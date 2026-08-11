import { redirect } from 'next/navigation';
import { config } from '@config';

/**
 * Root page - redirects to the configured default locale.
 */
export default function RootPage() {
  redirect(`/${config.app.i18n.defaultLocale}`);
}
