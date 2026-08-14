import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(chat)/discover')({
  component: Outlet,
})
