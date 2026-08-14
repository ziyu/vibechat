import { createFileRoute } from '@tanstack/react-router'
import { VideoGenerationPage } from '@/features/ai/video-generation-page'

export const Route = createFileRoute('/(product)/video-generate')({ component: VideoGenerationPage })
