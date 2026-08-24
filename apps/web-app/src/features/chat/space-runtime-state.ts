import type { SpaceRuntimeSnapshot } from '@vibechat/space-app-contracts'

export interface ReadySpaceAppTarget {
  roomId: string
  revisionId: string
  url: string
}

export function selectAgentConversationMessages(
  snapshot: SpaceRuntimeSnapshot | null,
): SpaceRuntimeSnapshot['messages'] {
  return snapshot?.messages.filter(
    (message) => message.type === 'agent' && message.authorId !== 'kernel',
  ) || []
}

export function shouldProjectRuntimeEventToApp(
  event: Record<string, unknown> & { type: string },
): boolean {
  if (event.type !== 'message') return true
  const message = event.message
  if (!message || typeof message !== 'object') return false
  const candidate = message as { type?: unknown; authorId?: unknown }
  return candidate.type === 'agent' && candidate.authorId !== 'kernel'
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
