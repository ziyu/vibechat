import { describe, expect, test } from 'vitest'
import { getTrustedAuthOrigins } from '@libs/auth/trusted-origins'

describe('Better Auth trusted origins', () => {
  test('allows the fixed local Admin origin in development without local env overrides', () => {
    const origins = getTrustedAuthOrigins(
      new Request('http://localhost:8002/api/auth/sign-in/email', {
        headers: { origin: 'http://localhost:8001' },
      }),
      { NODE_ENV: 'development' },
    )

    expect(origins).toContain('http://localhost:8005')
    expect(origins).toContain('http://127.0.0.1:8005')
    expect(origins).toContain('http://localhost:8001')
    expect(origins).toContain('http://localhost:8002')
  })

  test('does not add localhost origins automatically in production', () => {
    const origins = getTrustedAuthOrigins(
      new Request('http://localhost:8002/api/auth/sign-in/email', {
        headers: { origin: 'http://localhost:8001' },
      }),
      {
        NODE_ENV: 'production',
        APP_BASE_URL: 'https://app.vibechat.example',
        BETTER_AUTH_URL: 'https://api.vibechat.example',
        ADMIN_APP_ORIGIN: 'https://admin.vibechat.example',
      },
    )

    expect(origins).toEqual([
      'https://app.vibechat.example',
      'https://api.vibechat.example',
      'https://admin.vibechat.example',
    ])
  })

  test('ignores malformed and non-local request origins in development', () => {
    const origins = getTrustedAuthOrigins(
      new Request('https://api.example.com/api/auth/sign-in/email', {
        headers: { origin: 'https://attacker.example' },
      }),
      { NODE_ENV: 'development' },
    )

    expect(origins).not.toContain('https://api.example.com')
    expect(origins).not.toContain('https://attacker.example')
  })
})
