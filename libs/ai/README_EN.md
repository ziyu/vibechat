# `@libs/ai`

Backend-internal AI domain covering active chat, image and video generation. Chat uses credit reservation and usage settlement; image/video requests persist task ownership and provider state; all provider/setup/stream failures use deterministic one-time refunds.

HTTP adapters live under `apps/backend/src/routes/api/{chat,image-generate,video-generate}` and product screens under `apps/web-app/src/features/ai`. See [`docs/stable/runbooks/ai.md`](../../docs/stable/runbooks/ai.md) for configuration and verification.
