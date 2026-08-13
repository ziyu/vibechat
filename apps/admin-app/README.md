# VibeChat Admin App

Independent internal operations UI for VibeChat. It runs on port `8005` and proxies `/api/*` to the shared Backend on `8002`.

The app never imports server database or provider implementations. Sign in is performed by the product Web host, then the localhost/production gateway session is reused by the Admin host.

Local development keeps `ADMIN_APP_ORIGIN=http://localhost:8005` and `VITE_ADMIN_APP_ORIGIN=http://localhost:8005` in the root `.env`. Production must set both values to the deployed Admin origin so Better Auth can validate the post-login callback.
