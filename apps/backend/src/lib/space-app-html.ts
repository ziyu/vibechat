import { spaceAppBrowserSource } from '@vibechat/space-app-sdk/browser-source'

export function injectSpaceAppSdk(html: string) {
  if (html.includes('data-vibechat-space-sdk')) return html
  const sdkSource = spaceAppBrowserSource
    .replace(/^export const space\s*=/m, 'const space =')
    .replace(/<\/script/gi, '<\\/script')
  const sdkScript = `<script data-vibechat-space-sdk>${sdkSource}</script>`
  const appHtml = html.replace(
    /import\s*\{\s*space\s*\}\s*from\s*["']\/v1\/space-app-sdk["']\s*;?/g,
    'const space = globalThis.spaceApp;',
  )
  if (/<head(?:\s[^>]*)?>/i.test(appHtml)) {
    return appHtml.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${sdkScript}`)
  }
  return `${sdkScript}${appHtml}`
}
