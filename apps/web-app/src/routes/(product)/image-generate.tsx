import { createFileRoute } from '@tanstack/react-router'
import { ImageGenerationPage } from '@/features/ai/image-generation-page'

export const Route = createFileRoute('/(product)/image-generate')({ component: ImageGenerationPage })
