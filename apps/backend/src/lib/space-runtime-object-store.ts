import { isWorkersRuntime } from '@libs/database'
import {
  R2RuntimeObjectStore,
  type RuntimeObjectStore,
  type RuntimeR2Bucket,
} from '@libs/space-runtime-control'

let objectStore: RuntimeObjectStore | undefined

export async function getSpaceRuntimeObjectStore(): Promise<RuntimeObjectStore> {
  if (objectStore) return objectStore
  if (isWorkersRuntime) {
    const { env } = await import('cloudflare:workers')
    const bucket = (env as { R2_BUCKET?: RuntimeR2Bucket }).R2_BUCKET
    if (!bucket) throw new Error('R2_BUCKET is required for Space Runtime objects')
    objectStore = new R2RuntimeObjectStore(bucket)
    return objectStore
  }
  objectStore = await createLocalObjectStore()
  return objectStore
}

async function createLocalObjectStore(): Promise<RuntimeObjectStore> {
  const [{ mkdir, readFile, writeFile }, { join }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ])
  const directory = join(process.cwd(), '.data', 'space-runtime-objects')
  return {
    async put(content, contentType) {
      const hash = await sha256(content)
      const objectKey = `space-runtime/objects/${hash.slice('sha256:'.length)}`
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, objectKey.split('/').at(-1)!), content)
      void contentType
      return { objectKey, hash }
    },
    async get(objectKey) {
      const match = /^space-runtime\/objects\/([a-f0-9]{64})$/.exec(objectKey)
      if (!match) return null
      try {
        return new Uint8Array(await readFile(join(directory, match[1])))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
  }
}

async function sha256(content: Uint8Array): Promise<`sha256:${string}`> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(content).buffer,
  )
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}
