import { describe, expect, it } from 'vitest'
import { createMatrixTextContent } from '@vibechat/matrix-client/message-content'
import { spaceAgentMentionsEventContentKey } from '@vibechat/api-contracts'

describe('Matrix Agent mention metadata', () => {
  it('persists the platform Agent target on the confirmed chat event', async () => {
    const content = createMatrixTextContent(
      '@pi hello',
      undefined,
      [{ type: 'agent', id: 'pi' }],
    )

    expect(content).toEqual(expect.objectContaining({
      body: '@pi hello',
      [spaceAgentMentionsEventContentKey]: [{ type: 'agent', id: 'pi' }],
    }))
  })

  it('keeps Matrix member mentions separate from logical Agent mentions', () => {
    const content = createMatrixTextContent(
      '@Bob @pi hello',
      undefined,
      [{ type: 'agent', id: 'pi' }],
      ['@bob:localhost', '@bob:localhost', 'not-a-matrix-user'],
    )

    expect(content).toMatchObject({
      [spaceAgentMentionsEventContentKey]: [{ type: 'agent', id: 'pi' }],
      'm.mentions': { user_ids: ['@bob:localhost'] },
    })
  })
})
