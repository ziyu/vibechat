import { createFileRoute } from '@tanstack/react-router'
import {
  createRoomRequestSchema,
  productApiErrorSchema,
  roomBootstrapSchema,
} from '@vibechat/api-contracts'
import { createDefaultIdentityService } from '@libs/identity'
import {
  createDefaultRoomService,
  MatrixRoomAdapterError,
  RoomServiceError,
} from '@libs/rooms'
import { SocialServiceError } from '@libs/social'
import { withCfDb } from '@/lib/with-request-db'
import { socialServiceErrorResponse } from '@/lib/social-api'
import { ensureDefaultSpaceAgentBinding } from '@/lib/space-agent-binding-provisioning'

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') || globalThis.crypto.randomUUID()
}

function productError(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return Response.json(productApiErrorSchema.parse({
    error: { code, message, details, requestId },
  }), {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-request-id': requestId,
    },
  })
}

export const Route = createFileRoute('/v1/rooms/')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        const requestId = getRequestId(request)

        try {
          const { auth } = await import('@libs/auth')
          const session = await auth.api.getSession({
            headers: new Headers(request.headers),
          })
          if (!session?.user?.id) {
            return productError(
              requestId,
              401,
              'AUTH_SESSION_REQUIRED',
              'An authenticated session is required.',
            )
          }

          const parsed = createRoomRequestSchema.safeParse(await request.json())
          if (!parsed.success) {
            return productError(
              requestId,
              400,
              'ROOM_REQUEST_INVALID',
              'The room request is invalid.',
              { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
            )
          }

          const credentials = await createDefaultIdentityService()
            .getActiveSessionCredentials(session.session.id)
          if (!credentials) {
            return productError(
              requestId,
              409,
              'MATRIX_SESSION_NOT_READY',
              'Bootstrap the current session before creating a room.',
            )
          }

          const room = await createDefaultRoomService().createRoom({
            creatorUserId: session.user.id,
            creatorMatrixUserId: credentials.matrixUserId,
            accessToken: credentials.accessToken,
            ...parsed.data,
          })
          await ensureDefaultSpaceAgentBinding(room)
          const response = roomBootstrapSchema.parse({
            matrixRoomId: room.matrixRoomId,
            spaceInstanceId: room.spaceInstanceId,
            projectId: room.projectId,
            defaultAgentId: room.defaultAgentId,
            spaceId: room.spaceId,
            spaceVersionId: room.spaceVersionId,
            status: room.status,
            createdAt: room.createdAt.toISOString(),
            updatedAt: room.updatedAt.toISOString(),
          })

          return Response.json(response, {
            status: 201,
            headers: {
              'cache-control': 'private, no-store',
              'x-request-id': requestId,
            },
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return productError(
              requestId,
              400,
              'ROOM_REQUEST_INVALID',
              'The room request is invalid.',
            )
          }
          if (error instanceof RoomServiceError) {
            const status = error.code === 'ROOM_SPACE_NOT_FOUND' ? 404 : 409
            return productError(requestId, status, error.code, error.code)
          }
          if (error instanceof SocialServiceError) {
            return socialServiceErrorResponse(requestId, error)
          }
          if (error instanceof MatrixRoomAdapterError) {
            return productError(
              requestId,
              502,
              'MATRIX_ROOM_CREATE_FAILED',
              'The Matrix room could not be created.',
              {
                status: error.status,
                matrixErrorCode: error.matrixErrorCode,
              },
            )
          }

          console.error('[rooms] Failed to create room', {
            requestId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          })
          return productError(
            requestId,
            500,
            'ROOM_CREATE_FAILED',
            'The room could not be created.',
          )
        }
      }),
    },
  },
})
