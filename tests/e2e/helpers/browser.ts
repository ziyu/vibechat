import type { BrowserContext } from '@playwright/test'

const CONTEXT_CLOSE_TIMEOUT_MS = 2_000

export async function closeBrowserContexts(contexts: BrowserContext[]) {
  await Promise.all(contexts.map(async (context) => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        context.close().catch(() => undefined),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, CONTEXT_CLOSE_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }))
}
