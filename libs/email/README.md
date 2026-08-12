# VibeChat 邮件服务

Backend 内部邮件发送与多语言模板实现，当前 provider 为 Resend 和 Cloudflare REST API。MJML 在构建期编译为静态 HTML，以支持 Node 和 Cloudflare Workers。

配置 `EMAIL_DEFAULT_FROM`，并按 provider 配置 `RESEND_API_KEY` 或 Cloudflare 账号凭据。修改模板后运行 `pnpm email:compile`。
