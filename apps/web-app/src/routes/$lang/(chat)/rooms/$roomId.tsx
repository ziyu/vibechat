import { createFileRoute } from '@tanstack/react-router'
import { RoomPage } from '@/features/chat/room-page'

export const Route = createFileRoute('/$lang/(chat)/rooms/$roomId')({
  component: RoomRoute,
})

function RoomRoute() {
  const { roomId } = Route.useParams()
  return <RoomPage roomId={roomId} />
}

