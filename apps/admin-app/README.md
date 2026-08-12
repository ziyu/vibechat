# VibeChat Admin App

Independent internal operations UI for VibeChat. It runs on port `8005` and proxies `/api/*` to the shared Backend on `8002`.

The app never imports server database or provider implementations. Sign in is performed by the product Web host, then the localhost/production gateway session is reused by the Admin host.
