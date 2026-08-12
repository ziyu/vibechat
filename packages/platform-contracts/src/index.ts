export interface ProductNavigation {
  openMessages(locale: string): void
  openOnboarding(locale: string): void
  openSignIn(locale: string): void
  reload(): void
}

export interface ClientStorageCapability {
  remove(key: string): void
}

export interface ProductPlatform {
  navigation: ProductNavigation
  storage: ClientStorageCapability
  indexedDB: IDBFactory
  isOnline(): boolean
  onOnline(listener: () => void): () => void
  setTimeout(listener: () => void, delayMs: number): number
  clearTimeout(timerId: number): void
}
