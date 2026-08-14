# VibeChat Email Service

Backend-internal sending and localized templates for Resend and the Cloudflare REST API. MJML is compiled to static HTML at build time for Node and Cloudflare Workers compatibility.

Set `EMAIL_DEFAULT_FROM` and the selected provider credentials. Run `pnpm email:compile` after template changes.
