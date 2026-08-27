import { describe, expect, it } from 'vitest'
import {
  DevPreviewManager,
  draftVersion,
  type DevPreviewVmFactory,
} from '../../../apps/space-runtime/src/dev-preview'
import { createProjectDependencyPreparer } from '../../../apps/space-runtime/src/project-dependencies'
import type { ProjectFiles } from '../../../apps/space-runtime/src/project-store'
import { createSpaceAppManagedPackageArtifact } from '@vibechat/space-app-dependencies'

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
  readonly writtenFiles: Array<{ path: string; content: string }> = []
  readonly pid: number
  version = ''
  failSpawn = false

  constructor(readonly actorKey: string, pid: number) {
    this.pid = pid
  }

  readonly filesystem = {
    mkdir: async (_path: string, _options: unknown) => undefined,
    writeFiles: async (files: Array<{ path: string; content: string }>) => {
      this.writtenFiles.push(...files)
    },
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

function managedDependency() {
  const name = '@vibechat/space-app-components'
  const artifact = createSpaceAppManagedPackageArtifact({
    name,
    version: '1.0.0',
    projectFormats: ['agentos-app-v1'],
    files: {
      'package.json': JSON.stringify({
        name,
        version: '1.0.0',
        type: 'module',
        exports: {
          './chat': { import: './chat/index.js' },
        },
      }),
      'chat/index.js': 'export const managedValue = "ready";\n',
      'chat/index.d.ts': 'export declare const managedValue: string;\n',
    },
  })
  const files: ProjectFiles = {
    ...project('managed'),
    'package.json': JSON.stringify({
      name: 'space-managed',
      private: true,
      type: 'module',
      dependencies: { [name]: artifact.version },
    }),
    'space-app-dependencies.json': JSON.stringify({
      schemaVersion: 'vibechat.space-app-dependencies/v1',
      packages: {
        [name]: {
          version: artifact.version,
          integrity: artifact.integrity,
        },
      },
    }),
    'src/index.ts': `import { managedValue } from "${name}/chat";\nexport default { fetch() { return new Response(managedValue) } }`,
  }
  return { artifact, files }
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

  it('materializes managed package runtime imports and omits declarations from the Dev build', async () => {
    const vms = fakeVms(new Set())
    const { artifact, files } = managedDependency()
    const manager = new DevPreviewManager(
      vms.factory,
      createProjectDependencyPreparer({ resolve: async () => artifact }),
    )

    const ready = await manager.prepare('space-preview-managed', files)
    const vm = [...vms.instances.values()].find((item) =>
      item.actorKey.endsWith(`-${ready.version}`),
    )
    const compiledEntry = vm?.writtenFiles.find((file) =>
      file.path === '/workspace/.space-dev/src/index.js',
    )

    expect(ready.prepared.dependencies).toHaveLength(1)
    expect(ready.prepared.files['package.json']).toContain(
      'file:vendor/vibechat-packages/vibechat/space-app-components',
    )
    expect(files['package.json']).not.toContain('file:vendor/')
    expect(compiledEntry?.content).toContain(
      'file:///workspace/.space-dev/vendor/vibechat-packages/vibechat/space-app-components/chat/index.js',
    )
    expect(ready.prepared.files[
      'vendor/vibechat-packages/vibechat/space-app-components/chat/index.d.ts'
    ]).toContain('export declare const managedValue')
    expect(vm?.writtenFiles.some((file) => file.path.endsWith('/chat/index.d.js'))).toBe(false)
  })

  it('reuses a persisted prepared artifact on cold start without Registry access', async () => {
    const firstVms = fakeVms(new Set())
    const { artifact, files } = managedDependency()
    const first = await new DevPreviewManager(
      firstVms.factory,
      createProjectDependencyPreparer({ resolve: async () => artifact }),
    ).prepare('space-preview-cold-start', files)
    let registryCalls = 0
    const coldVms = fakeVms(new Set())
    const cold = await new DevPreviewManager(
      coldVms.factory,
      createProjectDependencyPreparer({
        resolve: async () => {
          registryCalls += 1
          return null
        },
      }),
    ).prepare(
      'space-preview-cold-start',
      files,
      undefined,
      first.prepared,
    )

    expect(cold.version).toBe(first.version)
    expect(cold.prepared.artifactHash).toBe(first.prepared.artifactHash)
    expect(registryCalls).toBe(0)
  })

  it('keeps the ready Revision available when a new dependency cannot resolve', async () => {
    const vms = fakeVms(new Set())
    const manager = new DevPreviewManager(
      vms.factory,
      createProjectDependencyPreparer({ resolve: async () => null }),
    )
    const ready = await manager.prepare(
      'space-preview-dependency-failure',
      project('ready-before-dependency'),
    )
    const { files } = managedDependency()

    await expect(manager.prepare('space-preview-dependency-failure', files))
      .rejects.toThrow('is unavailable')
    const response = await manager.fetch(
      'space-preview-dependency-failure',
      `http://space-dev.local/?version=${ready.version}`,
      { method: 'GET', headers: {} },
    )
    expect(decoder.decode(response.body)).toContain(`:${ready.version}`)
  })
})
