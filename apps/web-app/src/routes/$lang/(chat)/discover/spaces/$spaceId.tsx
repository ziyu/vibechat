import { createFileRoute } from '@tanstack/react-router'
import { DiscoverPage } from '@/features/chat/discover-page'

export const Route = createFileRoute('/$lang/(chat)/discover/spaces/$spaceId')({
  component: SpaceDetailRoute,
})

function SpaceDetailRoute() {
  const { spaceId } = Route.useParams()
  return <DiscoverPage spaceId={spaceId} />
}

