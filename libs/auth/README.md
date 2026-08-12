# VibeChat 服务端认证

Backend 内部 Better Auth 实现，提供 Email OTP、兼容密码登录、手机/社交插件、Admin 角色和 session 生命周期。Web、Admin 等浏览器宿主只使用 `@vibechat/auth-client`，不得直接导入本目录。

必需配置为 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL` 和 `APP_BASE_URL`；独立 Admin 部署还需配置 `ADMIN_APP_ORIGIN`。Cloudflare 本地预览方式见 `apps/backend/CF-NOTES.md`。
