import { createFileRoute } from '@tanstack/react-router'
import {
  roomMetadataLookupRequestSchema,
  roomMetadataLookupResponseSchema,
} from '@vibechat/api-contracts'
import { createDefaultRoomService } from '@libs/rooms'
import {
  productApiError,
  productRequestId,
  requireProductSession,
} from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/rooms/metadata')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        try {
          const parsed = roomMetadataLookupRequestSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productApiError(
              requestId,
              400,
              'ROOM_METADATA_REQUEST_INVALID',
              'The room metadata request is invalid.',
            )
          }
          const rooms = await createDefaultRoomService().lookupAccessibleRooms(
            auth.session.user.id,
            parsed.data.matrixRoomIds,
          )
          return Response.json(roomMetadataLookupResponseSchema.parse({
            rooms: rooms.map((room) => ({
              matrixRoomId: room.matrixRoomId,
              spaceInstanceId: room.spaceInstanceId,
              projectId: room.projectId,
              defaultAgentId: room.defaultAgentId,
              startMode: room.spaceId ? 'template' : 'blank',
              spaceId: room.spaceId,
              spaceVersionId: room.spaceVersionId,
              spaceTemplateId: room.spaceId,
              spaceTemplateVersionId: room.spaceVersionId,
              status: room.status,
              createdAt: room.createdAt.toISOString(),
              updatedAt: room.updatedAt.toISOString(),
            })),
          }), {
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': requestId,
            },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productApiError(
              requestId,
              400,
              'ROOM_METADATA_REQUEST_INVALID',
              'Invalid JSON.',
            )
          }
          throw error
        }
      }),
    },
  },
})
