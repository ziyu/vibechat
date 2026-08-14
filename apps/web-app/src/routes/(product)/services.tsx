import { createFileRoute } from '@tanstack/react-router'
import { ServicesPage } from '@/features/services/services-page'

export const Route = createFileRoute('/(product)/services')({ component: ServicesPage })
