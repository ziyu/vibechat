import { describe, expect, it } from 'vitest'
import { parseSpaceRuntimeSchedulingConfig } from '../../../apps/space-runtime/src/runtime-config'

describe('Space Runtime scheduling configuration', () => {
  it('uses platform defaults when no scheduling variables are configured', () => {
    expect(parseSpaceRuntimeSchedulingConfig({})).toEqual({
      maximumConcurrentTurns: 2,
      turnBatchWindowMs: 350,
      sources: {
        maximumConcurrentTurns: 'default',
        turnBatchWindowMs: 'default',
      },
    })
  })

  it('prefers SPACE_* variables and preserves the existing clamps', () => {
    expect(parseSpaceRuntimeSchedulingConfig({
      SPACE_AGENT_MAX_CONCURRENCY: '99',
      SPACE_TURN_BATCH_WINDOW_MS: '-10',
      PI_MAX_CONCURRENCY: '3',
      PI_BATCH_WINDOW_MS: '700',
    })).toEqual({
      maximumConcurrentTurns: 8,
      turnBatchWindowMs: 0,
      sources: {
        maximumConcurrentTurns: 'SPACE_AGENT_MAX_CONCURRENCY',
        turnBatchWindowMs: 'SPACE_TURN_BATCH_WINDOW_MS',
      },
    })
  })

  it('accepts PI_* variables as a one-cycle compatibility fallback', () => {
    expect(parseSpaceRuntimeSchedulingConfig({
      PI_MAX_CONCURRENCY: '5',
      PI_BATCH_WINDOW_MS: '450',
    })).toEqual({
      maximumConcurrentTurns: 5,
      turnBatchWindowMs: 450,
      sources: {
        maximumConcurrentTurns: 'PI_MAX_CONCURRENCY',
        turnBatchWindowMs: 'PI_BATCH_WINDOW_MS',
      },
    })
  })

  it('keeps the previous invalid-value behavior', () => {
    expect(parseSpaceRuntimeSchedulingConfig({
      SPACE_AGENT_MAX_CONCURRENCY: '0',
      SPACE_TURN_BATCH_WINDOW_MS: 'invalid',
    })).toMatchObject({
      maximumConcurrentTurns: 2,
      turnBatchWindowMs: 0,
    })
  })
})
