import { createFileRoute } from '@tanstack/react-router'
import { authorizeSpaceRuntimeCallback } from '@/lib/space-runtime-callback-auth'
import { getSpaceRuntimeObjectStore } from '@/lib/space-runtime-object-store'

const maximumObjectBytes = 3 * 1024 * 1024

export const Route = createFileRoute('/v1/internal/space-runtime-objects/$objectHash')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { objectHash: string } }) => {
        if (!await authorizeSpaceRuntimeCallback(request)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        if (!isObjectHash(params.objectHash)) {
          return Response.json({ error: 'invalid_object_hash' }, { status: 400 })
        }
        const object = await (await getSpaceRuntimeObjectStore()).get(
          `space-runtime/objects/${params.objectHash}`,
        )
        if (!object) return Response.json({ error: 'not_found' }, { status: 404 })
        return new Response(Uint8Array.from(object).buffer, {
          headers: {
            'cache-control': 'private, max-age=31536000, immutable',
            'content-type': 'application/json; charset=utf-8',
            'x-content-type-options': 'nosniff',
          },
        })
      },
      PUT: async ({ request, params }: { request: Request; params: { objectHash: string } }) => {
        if (!await authorizeSpaceRuntimeCallback(request)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        if (!isObjectHash(params.objectHash)) {
          return Response.json({ error: 'invalid_object_hash' }, { status: 400 })
        }
        const declaredLength = Number(request.headers.get('content-length') || 0)
        if (declaredLength > maximumObjectBytes) {
          return Response.json({ error: 'object_too_large' }, { status: 413 })
        }
        const content = new Uint8Array(await request.arrayBuffer())
        if (content.byteLength > maximumObjectBytes) {
          return Response.json({ error: 'object_too_large' }, { status: 413 })
        }
        const stored = await (await getSpaceRuntimeObjectStore()).put(
          content,
          'application/json; charset=utf-8',
        )
        if (stored.hash !== `sha256:${params.objectHash}`) {
          return Response.json({ error: 'object_hash_mismatch' }, { status: 422 })
        }
        return Response.json({ objectKey: stored.objectKey, hash: stored.hash }, { status: 201 })
      },
    },
  },
})

function isObjectHash(value: string) {
  return /^[a-f0-9]{64}$/.test(value)
}
