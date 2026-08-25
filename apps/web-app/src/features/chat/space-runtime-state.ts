import type { SpaceRuntimeSnapshot } from '@vibechat/space-app-contracts'

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
