import {
  spaceAppBridgeCommandEnvelopeSchema,
  type SpaceAppBridgeCommandEnvelope,
  type SpaceRuntimeSnapshot,
} from '@vibechat/space-app-contracts'

const spaceAppBridgePayloadLimitBytes = 64 * 1024
const spaceAppBridgeRateWindowMs = 10_000
const spaceAppBridgeRateLimit = 120

export interface SpaceAppBridgeGuard {
  nonce: string
  lastSequence: number
  windowStartedAt: number
  acceptedInWindow: number
}

export type SpaceAppBridgeGuardResult =
  | {
      ok: true
      command: SpaceAppBridgeCommandEnvelope
      guard: SpaceAppBridgeGuard
    }
  | {
      ok: false
      code:
        | 'SPACE_APP_BRIDGE_COMMAND_INVALID'
        | 'SPACE_APP_BRIDGE_NONCE_INVALID'
        | 'SPACE_APP_BRIDGE_SEQUENCE_INVALID'
        | 'SPACE_APP_BRIDGE_PAYLOAD_TOO_LARGE'
        | 'SPACE_APP_BRIDGE_RATE_LIMITED'
    }

export function createSpaceAppBridgeGuard(
  nonce: string,
  now = Date.now(),
): SpaceAppBridgeGuard {
  return {
    nonce,
    lastSequence: 0,
    windowStartedAt: now,
    acceptedInWindow: 0,
  }
}

export function validateSpaceAppBridgeCommand(
  value: unknown,
  guard: SpaceAppBridgeGuard,
  now = Date.now(),
): SpaceAppBridgeGuardResult {
  const parsed = spaceAppBridgeCommandEnvelopeSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, code: 'SPACE_APP_BRIDGE_COMMAND_INVALID' }
  }
  if (parsed.data.nonce !== guard.nonce) {
    return { ok: false, code: 'SPACE_APP_BRIDGE_NONCE_INVALID' }
  }
  if (parsed.data.sequence <= guard.lastSequence) {
    return { ok: false, code: 'SPACE_APP_BRIDGE_SEQUENCE_INVALID' }
  }

  let payloadBytes = Number.POSITIVE_INFINITY
  try {
    payloadBytes = new TextEncoder().encode(JSON.stringify(parsed.data.payload)).byteLength
  } catch {
    // Structured-clone supports cyclic values, but the public bridge contract does not.
  }
  if (payloadBytes > spaceAppBridgePayloadLimitBytes) {
    return { ok: false, code: 'SPACE_APP_BRIDGE_PAYLOAD_TOO_LARGE' }
  }

  const nextWindow = now - guard.windowStartedAt >= spaceAppBridgeRateWindowMs
  const windowStartedAt = nextWindow ? now : guard.windowStartedAt
  const acceptedInWindow = nextWindow ? 0 : guard.acceptedInWindow
  if (acceptedInWindow >= spaceAppBridgeRateLimit) {
    return { ok: false, code: 'SPACE_APP_BRIDGE_RATE_LIMITED' }
  }

  return {
    ok: true,
    command: parsed.data,
    guard: {
      nonce: guard.nonce,
      lastSequence: parsed.data.sequence,
      windowStartedAt,
      acceptedInWindow: acceptedInWindow + 1,
    },
  }
}

export interface ReadySpaceAppTarget {
  roomId: string
  revisionId: string
  url: string
}

export function shouldProjectRuntimeEventToApp(
  event: Record<string, unknown> & { type: string },
): boolean {
  return event.type !== 'message'
}

export function selectReadySpaceAppTarget({
  roomId,
  snapshot,
  previous,
  baseUrl,
}: {
  roomId: string
  snapshot: SpaceRuntimeSnapshot | null
  previous: ReadySpaceAppTarget | null
  baseUrl: string
}): ReadySpaceAppTarget | null {
  const revisionId = snapshot?.project.draftId
  const belongsToSpace = snapshot?.matrixRoomId === roomId
  const exactRevisionReady = snapshot?.devPreview.state === 'ready'
    && snapshot.devPreview.version === revisionId
  const candidateLeavesPreviousReady = (
    snapshot?.devPreview.state === 'building'
    || snapshot?.devPreview.state === 'failed'
  ) && snapshot.devPreview.version !== revisionId

  if (
    belongsToSpace
    && snapshot.project.exists
    && revisionId
    && (exactRevisionReady || candidateLeavesPreviousReady)
  ) {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return {
      roomId,
      revisionId,
      url: `${baseUrl}${separator}version=${encodeURIComponent(revisionId)}`,
    }
  }

  return previous?.roomId === roomId ? previous : null
}
