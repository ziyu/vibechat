import { describe, expect, it, vi } from 'vitest'
import { checkRivetEngineHealth } from '../../../apps/space-runtime/src/rivet-health'

describe('Space Runtime Rivet health', () => {
  it('reports a healthy Engine only for the expected health payload', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      runtime: 'engine',
      status: 'ok',
      version: '2.3.7',
    }))

    await expect(checkRivetEngineHealth(
      'http://127.0.0.1:6420',
      fetchMock as unknown as typeof globalThis.fetch,
    )).resolves.toEqual({
      ok: true,
      status: 200,
      runtime: 'engine',
      version: '2.3.7',
    })
  })

  it('fails closed when the Engine is unavailable or unhealthy', async () => {
    await expect(checkRivetEngineHealth(
      'http://127.0.0.1:6420',
      vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof globalThis.fetch,
    )).resolves.toEqual({ ok: false, status: null })

    await expect(checkRivetEngineHealth(
      'http://127.0.0.1:6420',
      vi.fn(async () => Response.json({ status: 'starting' }, { status: 503 })) as unknown as typeof globalThis.fetch,
    )).resolves.toEqual({ ok: false, status: 503 })
  })
})
