import { describe, expect, it } from 'vitest'
import { spaceIdFromStateContent } from '../../../packages/matrix-client/src/space-state'

describe('Matrix Space state compatibility', () => {
  it('reads the v1 templateId while Product metadata is still unavailable', () => {
    expect(spaceIdFromStateContent({ templateId: 'space-campfire' }))
      .toBe('space-campfire')
  })

  it('prefers the spaceId alias when both v1 field names are present', () => {
    expect(spaceIdFromStateContent({
      spaceId: 'space-instance-v2',
      templateId: 'space-campfire',
    })).toBe('space-instance-v2')
  })
})
