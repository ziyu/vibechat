import { injectSpaceAppSdk } from '../../../apps/backend/src/lib/space-app-html'
import { proxySpaceRuntimeAppResponse } from '../../../apps/backend/src/lib/space-runtime'
import { describe, expect, it } from 'vitest'

describe('Space App HTML host injection', () => {
  it('injects the trusted SDK and rewrites the sandbox-blocked module import', () => {
    const source = '<!doctype html><html><head></head><body><script type="module">import { space } from "/v1/space-app-sdk"; await space.ready;</script></body></html>'
    const result = injectSpaceAppSdk(source)

    expect(result).toContain('data-vibechat-space-sdk')
    expect(result).toContain('globalThis.spaceApp = space')
    expect(result).toContain('const space = globalThis.spaceApp;')
    expect(result).not.toContain('export const space')
    expect(result).not.toContain('from "/v1/space-app-sdk"')
  })

  it('is idempotent when a response has already been transformed', () => {
    const source = '<html><head></head><body></body></html>'
    const once = injectSpaceAppSdk(source)
    expect(injectSpaceAppSdk(once)).toBe(once)
  })

  it('injects the trusted SDK into successful Runtime HTML', async () => {
    const response = await proxySpaceRuntimeAppResponse(new Response(
      '<!doctype html><html><head></head><body><script type="module">import { space } from "/v1/space-app-sdk"; await space.ready;</script></body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    ))
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toContain(
      "script-src 'unsafe-inline' blob:",
    )
    expect(response.headers.get('content-security-policy')).toContain(
      "connect-src 'none'",
    )
    expect(html).toContain('data-vibechat-space-sdk')
    expect(html).not.toContain('from "/v1/space-app-sdk"')
  })

  it('preserves Runtime failures without synthesizing a Default Chat App', async () => {
    const response = await proxySpaceRuntimeAppResponse(new Response(
      JSON.stringify({ error: 'SPACE_RUNTIME_UNAVAILABLE' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    ))
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('x-vibechat-space-recovery')).toBeNull()
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(body).toContain('SPACE_RUNTIME_UNAVAILABLE')
    expect(body).not.toContain('data-vibechat-default-chat-app')
    expect(body).not.toContain('data-vibechat-space-sdk')
  })
})
