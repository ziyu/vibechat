import { describe, expect, it } from 'vitest'
import {
  DevPreviewManager,
  draftVersion,
  type DevPreviewVmFactory,
} from '../../../apps/space-runtime/src/dev-preview'
import type { ProjectFiles } from '../../../apps/space-runtime/src/project-store'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function project(label: string): ProjectFiles {
  return {
    'package.json': JSON.stringify({
      name: `space-${label}`,
      private: true,
      type: 'module',
    }),
    'tsconfig.json': JSON.stringify({
      compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' },
    }),
    'src/index.ts': `export default { fetch() { return new Response(${JSON.stringify(label)}) } }`,
  }
}

class FakeDevVm {
  readonly killed: number[] = []
  readonly pid: number
  version = ''
  failSpawn = false

  constructor(readonly actorKey: string, pid: number) {
    this.pid = pid
  }

  readonly filesystem = {
    mkdir: async (_path: string, _options: unknown) => undefined,
    writeFiles: async (_files: unknown) => undefined,
  }

  readonly javascript = {
    spawnFile: async (
      _path: string,
      options: { env?: Record<string, string> },
    ) => {
      if (this.failSpawn) throw new Error('candidate failed before startup')
      this.version = options.env?.SPACE_DEV_VERSION ?? ''
      return { pid: this.pid }
    },
  }

  readonly process = {
    kill: async (pid: number) => {
      this.killed.push(pid)
    },
    readOutput: async (_pid: number) => ({ events: [] }),
  }

  async vmFetch(_port: number, url: string, _request?: unknown) {
    const body = url.includes('/__space_dev_health')
      ? this.version
      : `${this.actorKey}:${this.version}`
    return {
      status: 200,
      statusText: 'OK',
      body: encoder.encode(body),
      headers: {},
      rawHeaders: [],
    }
  }
}

function fakeVms(failingVersions: Set<string>) {
  const instances = new Map<string, FakeDevVm>()
  const factory: DevPreviewVmFactory = (actorKey) => {
    let instance = instances.get(actorKey)
    if (!instance) {
      instance = new FakeDevVm(actorKey, instances.size + 100)
      instance.failSpawn = [...failingVersions].some((version) =>
        actorKey.endsWith(`-${version}`),
      )
      instances.set(actorKey, instance)
    }
    return instance as unknown as ReturnType<DevPreviewVmFactory>
  }
  return { factory, instances }
}

describe('Space Dev ready Revision isolation', () => {
  it('routes each ready Revision to its own preview instance', async () => {
    const vms = fakeVms(new Set())
    const manager = new DevPreviewManager(vms.factory)
    const first = await manager.prepare('space-preview-test', project('first'))
    const second = await manager.prepare('space-preview-test', project('second'))

    const firstResponse = await manager.fetch(
      'space-preview-test',
      `http://space-dev.local/?version=${first.version}`,
      { method: 'GET', headers: {} },
    )
    const secondResponse = await manager.fetch(
      'space-preview-test',
      `http://space-dev.local/?version=${second.version}`,
      { method: 'GET', headers: {} },
    )

    expect(decoder.decode(firstResponse.body)).toContain(`:${first.version}`)
    expect(decoder.decode(secondResponse.body)).toContain(`:${second.version}`)
    expect(decoder.decode(firstResponse.body)).not.toBe(decoder.decode(secondResponse.body))
  })

  it('keeps the last ready Revision callable when a Candidate fails', async () => {
    const failingVersions = new Set<string>()
    const vms = fakeVms(failingVersions)
    const manager = new DevPreviewManager(vms.factory)
    const readyFiles = project('ready')
    const ready = await manager.prepare('space-preview-failure', readyFiles)
    const candidateFiles = project('broken-candidate')
    const candidateVersion = draftVersion(candidateFiles)
    failingVersions.add(candidateVersion)

    await expect(manager.prepare('space-preview-failure', candidateFiles))
      .rejects.toThrow('candidate failed before startup')
    expect(manager.status('space-preview-failure')).toMatchObject({
      state: 'failed',
      version: candidateVersion,
    })

    const response = await manager.fetch(
      'space-preview-failure',
      `http://space-dev.local/?version=${ready.version}`,
      { method: 'GET', headers: {} },
    )
    expect(decoder.decode(response.body)).toContain(`:${ready.version}`)

    const recovered = await manager.prepare('space-preview-failure', readyFiles)
    expect(recovered.version).toBe(ready.version)
    expect(manager.status('space-preview-failure')).toMatchObject({
      state: 'ready',
      version: ready.version,
    })
  })
})
