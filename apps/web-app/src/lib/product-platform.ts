import type { ProductPlatform } from '@vibechat/platform-contracts'

export const browserProductPlatform: ProductPlatform = {
  navigation: {
    openSpaces: () => window.location.assign('/spaces'),
    openOnboarding: (locale) => window.location.assign(`/${locale}/onboarding`),
    openSignIn: (locale) => window.location.assign(`/${locale}/signin`),
    reload: () => window.location.reload(),
  },
  storage: {
    remove: (key) => window.localStorage.removeItem(key),
  },
  get indexedDB() {
    return window.indexedDB
  },
  isOnline: () => window.navigator.onLine,
  onOnline: (listener) => {
    window.addEventListener('online', listener)
    return () => window.removeEventListener('online', listener)
  },
  setTimeout: (listener, delayMs) => window.setTimeout(listener, delayMs),
  clearTimeout: (timerId) => window.clearTimeout(timerId),
}
