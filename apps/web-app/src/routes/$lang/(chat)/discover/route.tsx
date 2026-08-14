import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/(chat)/discover')({
  component: Outlet,
})

