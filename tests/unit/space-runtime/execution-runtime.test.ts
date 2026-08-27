import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type AgentExecutionHandle,
  type AgentExecutionRuntime,
} from '../../../apps/space-runtime/src/agent-runtime/contract'
import { agentExecutionActorKey } from '../../../apps/space-runtime/src/agent-runtime/agentos/actor-key'
import { AgentOsAgentExecutionRuntime } from '../../../apps/space-runtime/src/agent-runtime/agentos/execution-runtime'
import {
  type AppCandidateHandle,
  type AppReleaseInput,
  type AppReleaseResult,
} from '../../../apps/space-runtime/src/app-runtime/contract'
import { AgentOsAppExecutionRuntime } from '../../../apps/space-runtime/src/app-runtime/agentos/app-runtime'
import { runProjectTurn } from '../../../apps/space-runtime/src/adapters/pi/adapter'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Space execution runtime boundaries', () => {
  it('preserves the Pi actor key and isolates other agents by Space × Agent', () => {
    expect(agentExecutionActorKey({
      spaceInstanceId: 'space-one',
      agentId: 'pi',
    })).toBe('space-space-one')

    const first = agentExecutionActorKey({
      spaceInstanceId: 'space-one',
      agentId: 'other-agent',
    })
    const same = agentExecutionActorKey({
      spaceInstanceId: 'space-one',
      agentId: 'other-agent',
    })
    const differentAgent = agentExecutionActorKey({
      spaceInstanceId: 'space-one',
      agentId: 'another-agent',
    })
    const differentSpace = agentExecutionActorKey({
      spaceInstanceId: 'space-two',
      agentId: 'other-agent',
    })

    expect(first).toBe(same)
    expect(first).not.toBe(differentAgent)
    expect(first).not.toBe(differentSpace)
  })

  it('resolves Agent session VMs only through the injected runtime factory', () => {
    const handle = {} as AgentExecutionHandle
    const createHandle = vi.fn(() => handle)
    const runtime = new AgentOsAgentExecutionRuntime(createHandle)

    expect(runtime.open({
      spaceInstanceId: 'space-runtime-test',
      agentId: 'pi',
    })).toBe(handle)
    expect(createHandle).toHaveBeenCalledWith('space-space-runtime-test')
  })

  it('routes AgentOS project turns through the injected Agent runtime', async () => {
    vi.stubEnv('PI_MODE', 'agentos')
    vi.stubEnv('OPENAI_API_KEY', 'test-provider-key')
    vi.stubEnv('AI_MODEL', '')
    const files = {
      'package.json': '{}',
      'tsconfig.json': '{}',
      'src/index.ts': 'export default {}',
    }
    const storedFiles = new Map(
      Object.entries(files).map(([path, content]) => [`/workspace/${path}`, content]),
    )
    const dispose = vi.fn(async () => undefined)
    const handle: AgentExecutionHandle = {
      makeDirectory: vi.fn(async () => undefined),
      writeFile: vi.fn(async (path: string, content: string) => {
        storedFiles.set(path, content)
      }),
      readFile: vi.fn(async (path: string) =>
        new TextEncoder().encode(storedFiles.get(path) ?? ''),
      ),
      listSessions: vi.fn(async () => []),
      openSession: vi.fn(async () => undefined),
      deleteSession: vi.fn(async () => undefined),
      connect: vi.fn(async () => ({ dispose })),
      prompt: vi.fn(async () => ({
        content: [{ type: 'text', text: '没有修改项目。' }],
      })),
    }
    const open = vi.fn(() => handle)
    const runtime: AgentExecutionRuntime = { open }

    await expect(runProjectTurn({
      spaceInstanceId: 'space-runtime-test',
      request: '只回复，不修改应用',
      files,
    }, runtime)).resolves.toEqual({
      kind: 'chat',
      message: '没有修改项目。',
    })
    expect(open).toHaveBeenCalledWith({
      spaceInstanceId: 'space-runtime-test',
      agentId: 'pi',
    })
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('cancels an active AgentOS Pi session through the provider-neutral signal', async () => {
    vi.stubEnv('PI_MODE', 'agentos')
    vi.stubEnv('OPENAI_API_KEY', 'test-provider-key')
    vi.stubEnv('AI_MODEL', '')
    let markPromptStarted: (() => void) | undefined
    const promptStarted = new Promise<void>((resolve) => {
      markPromptStarted = resolve
    })
    const dispose = vi.fn(async () => undefined)
    const deleteSession = vi.fn(async () => undefined)
    const handle: AgentExecutionHandle = {
      makeDirectory: vi.fn(async () => undefined),
      writeFile: vi.fn(async () => undefined),
      readFile: vi.fn(async () => new Uint8Array()),
      listSessions: vi.fn(async () => []),
      openSession: vi.fn(async () => undefined),
      deleteSession,
      connect: vi.fn(async () => ({ dispose })),
      prompt: vi.fn(() => {
        markPromptStarted?.()
        return new Promise(() => undefined)
      }),
    }
    const controller = new AbortController()
    const turn = runProjectTurn({
      spaceInstanceId: 'space-runtime-cancel',
      request: 'cancel this turn',
      files: {
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/index.ts': 'export default {}',
      },
    }, { open: () => handle }, controller.signal)

    await promptStarted
    controller.abort(new Error('lease lost'))

    await expect(turn).rejects.toThrow('lease lost')
    expect(deleteSession).toHaveBeenCalledWith('space-pi')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('delegates Dev VM and immutable Release operations through App runtime', async () => {
    const candidate = {} as AppCandidateHandle
    const deployment: AppReleaseResult = {
      releaseId: 'release-test',
      deployment: { release: 'release-test' },
    }
    const createCandidate = vi.fn(() => candidate)
    const deploy = vi.fn(async (_input: AppReleaseInput) => deployment)
    const runtime = new AgentOsAppExecutionRuntime(createCandidate, deploy)
    const input: AppReleaseInput = {
      spaceInstanceId: 'space-runtime-test',
      files: {
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/index.ts': 'export default {}',
      },
      scaling: { minReplicas: 0, maxReplicas: 16, targetConcurrency: 4 },
    }

    expect(runtime.openCandidate('space-dev-test')).toBe(candidate)
    await expect(runtime.deployRelease(input)).resolves.toBe(deployment)
    expect(createCandidate).toHaveBeenCalledWith('space-dev-test')
    expect(deploy).toHaveBeenCalledWith(input)
  })
})
