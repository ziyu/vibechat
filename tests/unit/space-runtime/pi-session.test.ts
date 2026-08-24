import { describe, expect, it } from 'vitest'
import { hostPiSessionId } from '../../../apps/space-runtime/src/generator'

describe('Host Pi session identity', () => {
  it('derives a stable valid UUID per Space without colliding across Spaces', () => {
    const first = hostPiSessionId('space-instance-1')
    const repeated = hostPiSessionId('space-instance-1')
    const other = hostPiSessionId('space-instance-2')

    expect(first).toBe(repeated)
    expect(first).not.toBe(other)
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  })
})
