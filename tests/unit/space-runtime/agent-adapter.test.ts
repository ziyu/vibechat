import { describe, expect, it, vi } from 'vitest'
import {
  createFakeAgentAdapter,
  SpaceAgentRegistry,
} from '../../../apps/space-runtime/src/agent-adapter'

const project = {
  'package.json': '{}',
  'tsconfig.json': '{}',
  'src/index.ts': 'export default {}',
}

describe('Space Agent Adapter contract', () => {
  it('registers provider-neutral adapters and rejects duplicate ids', () => {
    const adapter = createFakeAgentAdapter()
    const registry = new SpaceAgentRegistry([adapter])

    expect(registry.get('fake')).toBe(adapter)
    expect(registry.list()).toEqual([{
      id: 'fake',
      name: 'Fake Agent',
      available: true,
    }])
    expect(() => new SpaceAgentRegistry([adapter, adapter])).toThrow(
      'Duplicate Agent Adapter id: fake',
    )
  })

  it('uses the same chat, revision, repair, progress, and usage contract', async () => {
    const adapter = createFakeAgentAdapter({
      id: 'test-agent',
      name: 'Test Agent',
    })
    const onProgress = vi.fn()

    await expect(adapter.runProjectTurn({
      appId: 'space-1',
      request: 'hello',
      files: project,
      onProgress,
    })).resolves.toMatchObject({
      kind: 'chat',
      message: 'Test Agent received: hello',
      usage: { totalTokens: 13 },
    })
    await expect(adapter.runProjectTurn({
      appId: 'space-1',
      request: '[fake:revision] add a note',
      files: project,
    })).resolves.toMatchObject({
      kind: 'revision',
      summary: 'Test Agent created a deterministic revision.',
      files: { 'src/fake-agent-note.ts': expect.stringContaining('add a note') },
    })
    await expect(adapter.runProjectTurn({
      appId: 'space-1',
      request: '[fake:failure] exercise Candidate isolation',
      files: project,
    })).resolves.toMatchObject({
      kind: 'revision',
      summary: 'Test Agent created a deterministic failing revision.',
      files: {
        'src/fake-agent-failure.ts': expect.stringContaining(
          'deterministicCandidateFailure = ;',
        ),
      },
    })
    await expect(adapter.reviseProject({
      appId: 'space-1',
      request: 'repair',
      diagnostics: 'type error',
      files: project,
    })).resolves.toMatchObject({
      files: { 'src/fake-agent-repair.ts': expect.stringContaining('type error') },
    })
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      type: 'agent_delta',
    }))
  })
})
