# 多应用无前缀本地化集成记录

> 生命周期：开发中
> 状态：验证中
> 更新日期：2026-08-14
> 维护范围：`apps/site-app`、`apps/web-app`、`apps/admin-app`、`packages/i18n` 与 E2E

## 目标

Site、产品 Web 与 Admin 使用稳定的业务资源 URL，语言只作为用户偏好保存在 `VIBECHAT_LOCALE` Cookie 中。Docs App 的内容型语言 URL 不在本次迁移范围内。

## 当前实现

- 三个 TanStack 应用都在根路由 SSR 阶段解析 locale，并通过根 route context 提供翻译。
- 切换语言只更新 Cookie 并刷新当前页面，pathname、query 与 hash 保持不变。
- `/en/**` 和 `/zh-CN/**` 仅作为旧链接兼容边界，写入偏好后以 307 跳转到规范 URL。
- 未支持的语言样式路径不重定向，返回当前偏好语言的本地化 404。
- Site、Web 与 Admin 的页面路由已移出 `$lang`；Backend/API 和 Docs 路由契约不变。

## 完成条件

- 三个应用和 `@vibechat/i18n` 类型检查、构建通过。
- `pnpm boundaries:check`、`pnpm docs:check` 和差异检查通过。
- 多应用本地化 E2E 覆盖默认语言、切换持久化、旧链接和本地化 404。
- 真实浏览器确认 Site、Web、Admin 的规范路径、语言切换和控制台状态。
- PR 与最新 `main` 无冲突并完成可合并性核验。

## 验证证据

- `pnpm boundaries:check` 的底层检查脚本通过，共检查 294 个活动源码文件；`pnpm docs:check` 的底层文档检查通过。
- 10 个 `packages/*` 与 Backend、Web、Site、Admin 的类型检查通过。
- 10 个 workspace package 与 Backend、Web、Site、Admin 的生产构建通过。
- `tests/e2e/specs/i18n-switching.spec.ts` 与 `public-pages.spec.ts` 在 Chromium 中分别 5/5 通过。
- 真实浏览器确认 Site `/blog?page=1#posts` 切换语言后 URL 不变，Web 与 Admin 读取同一语言偏好，Admin 旧前缀保留 query/hash 后跳转，未支持语言路径返回本地化 404；浏览器控制台无 error。

剩余完成条件仅为提交推送后确认 PR 与最新 `main` 可合并。
