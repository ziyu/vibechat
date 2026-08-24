import { createFileRoute } from '@tanstack/react-router'
import { SpacePage } from '@/features/chat/space-page'

export const Route = createFileRoute('/(chat)/spaces/$spaceId')({
  component: SpaceRoute,
})

function SpaceRoute() {
  const { spaceId } = Route.useParams()
  return <SpacePage roomId={spaceId} />
}
