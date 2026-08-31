import { describe, expect, it } from 'vitest'
import { createFakeAgentAdapter } from '../../../apps/space-runtime/src/adapters/fake/adapter'
import {
  collectAgentEvents,
  createAgentTurnInputFixture,
  runAgentLifecycleContractSuite,
} from './agent-lifecycle-contract'

runAgentLifecycleContractSuite(
  'Fake Agent Adapter',
  (options) => createFakeAgentAdapter(options),
)

describe('Fake Agent Adapter lifecycle failure controls', () => {
  it('can omit usage so the Runtime billing failure path remains testable', async () => {
    const events = await collectAgentEvents(createFakeAgentAdapter().runTurn(
      createAgentTurnInputFixture({
        turnId: 'turn-missing-usage',
        requestText: '[fake:missing-usage] exercise refund handling',
      }),
      new AbortController().signal,
    ))

    expect(events.some((event) => event.type === 'usage')).toBe(false)
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      outcome: 'conversation',
    })
    expect(events.at(-1)).not.toHaveProperty('usage')
  })

  it('normalizes provider failure into a single versioned terminal event', async () => {
    const events = await collectAgentEvents(createFakeAgentAdapter().runTurn(
      createAgentTurnInputFixture({
        turnId: 'turn-provider-failure',
        requestText: '[fake:lifecycle-failure]',
      }),
      new AbortController().signal,
    ))

    expect(events.filter((event) => (
      event.type === 'completed' || event.type === 'failed'
    ))).toHaveLength(1)
    expect(events.at(-1)).toMatchObject({
      type: 'failed',
      error: {
        code: 'FAKE_PROVIDER_FAILURE',
        retryable: false,
        billingState: 'refund_required',
      },
    })
  })
})
