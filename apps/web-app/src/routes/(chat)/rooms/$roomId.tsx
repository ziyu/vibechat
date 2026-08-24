import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(chat)/rooms/$roomId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/spaces/$spaceId',
      params: { spaceId: params.roomId },
    })
  },
})
