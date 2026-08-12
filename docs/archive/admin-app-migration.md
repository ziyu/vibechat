# 独立 Admin App 迁移实施记录

> 生命周期：已归档
> 文档类型：计划
> 状态：已归档
> 更新日期：2026-08-12
> 维护范围：`apps/admin-app`、`apps/backend` 管理 API、管理权限、legacy Admin 与 `libs/*` 清理
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../stable/designs/vibechat-mvp-product-and-technical-design.md)

> 归档原因：Admin 迁移、libs/package 清理与全部完成条件已经核验。当前事实由稳定设计、Admin/Backend 局部文档和 TEST-CATALOG #38 维护。

## 决策

旧脚手架中的通用 Admin 仍有实际运营价值，不再按“整体退场”处理。用户、订阅、订单、积分、定价、Blog、佣金与提现管理迁入独立 `apps/admin-app`；后续 A4 空间审核作为同一 Admin App 的新模块加入，不再建立职责重叠的 `admin-review`。

Admin App 是独立的浏览器宿主，默认端口 `8005`，只消费共享 Backend HTTP API 和浏览器安全的 workspace packages。数据库、服务端 Auth、计费 provider 与运营领域 service 仍由 `apps/backend` 持有；Admin App 不直接导入这些实现。

## 实施范围

1. 创建可独立 typecheck、build 与运行的 `apps/admin-app`，恢复 legacy Admin 的有效页面与响应式运营壳层。
2. 将 legacy 管理 API 和统一 `requireAdminAPI` 权限入口迁入 `apps/backend`，所有管理接口保持未登录 `401`、非管理员 `403`。
3. Admin 浏览器侧继续复用 Better Auth session，但只通过自身同源 `/api/*` 网关访问 Backend；登录 UI 仍由产品 Web 承担。
4. 清理 legacy 中已经迁走的 Admin 源码、空目录、没有活动消费者的领域库和相应依赖；Backend 仍在使用的 affiliate、credits、pricing 等实现继续保留在 `libs/*`。
5. 更新 app 边界门禁，禁止 Admin App 导入数据库、服务端 Auth、支付/AI provider、存储和 Backend 内部领域实现。

## 非目标

- 不恢复旧 AI、生成、支付购买页或用户 Dashboard。
- 不在本切片实现 A4 空间审核协议；只为未来模块保留唯一的 Admin 宿主。
- 不因为目录整齐把所有 Backend 单消费者领域实现机械升级为 package。
- 不把 Admin 权限下放到前端判断；页面守卫只改善体验，Backend 权限校验仍是安全边界。

## `libs/*` 处置准则

| 分类 | 处置 |
| --- | --- |
| Backend 当前真实消费的 auth/database/identity/social/rooms/product-state/email/sms/storage | 保留为 Backend 内部实现 |
| Admin API 恢复后真实消费的 permissions/affiliate/credits/pricing | 保留并接受 Backend 构建与管理链路验证 |
| 多个浏览器 app 共同消费的 i18n/react-shared/ui/validators | 已整体迁入同名 `packages/*`，具有独立 manifests、exports、依赖和构建门槛；`libs/*` 不保留副本 |
| 只服务已隔离旧生成能力、没有活动 app 消费的 AI 实现 | 实现及相关测试、配置迁入 `legacy/`，退出活动依赖图 |
| 没有活动 provider 链路的 payment 实现 | provider SDK 实现及测试迁入 `legacy/`；仍被 Backend 定价读取使用的静态 payment 配置保留 |

## 完成条件

- [x] TEST-CATALOG #38 的认证、权限、运营读取与至少一个真实 mutation 场景通过。
- [x] Admin App、Backend、Web 与 Site 均可独立 typecheck/build，根级边界检查通过。
- [x] legacy Admin 页面/API 已迁出，legacy README 与活动路由事实一致。
- [x] `libs/*` 最终目录均有活动消费者或明确的保留理由；无空目录和重复实现。
- [x] 完整活动产品 E2E 无回归，管理 API 权限测试通过。
- [x] 当前重点、架构 RFC、稳定设计与运维说明同步完成。

## 验证记录

2026-08-12 完成以下验证：

- `pnpm docs:check`：通过。
- `pnpm typecheck`：边界检查覆盖 231 个活动源码文件，14/14 workspace 任务通过。
- `pnpm build --force`：10 个 packages 与 Backend/Web/Site/Admin 共 14/14 无缓存构建通过；`pnpm build:docs` 通过。
- 活动领域单测：affiliate 原子审批、identity、permissions、product state、rooms、social、validators、product client/core 共 103/103 通过。
- Admin API 权限测试：8/8 通过；Admin Playwright：3/3 通过，覆盖 401/403、八个运营域读取、8005 同源 Better Auth 创建用户和可恢复 mutation。
- `E2E_MATRIX_EXPECT_READY=1 pnpm test:e2e`：四应用 + 本地 Synapse 完整活动回归 39/39 通过，包含真实空账号、好友/房间、Matrix timeline、Admin 与积分查询输入上限。
- Cloudflare Workers + 本地 D1：`build:cf` 通过；注入本地预览 `BETTER_AUTH_SECRET` 后 health 200、Admin 未登录 401、session bootstrap 未登录 401。

非阻断 warning：现有 TanStack/Vite、Better Auth/Drizzle、Nitro/Jiti peer 版本提示；Node `module.register()` 弃用；Web 大 chunk 与 Workers 动态/静态 import 合并提示；Docs baseline browser 数据过期。后续作为依赖与 bundle 治理处理，不影响本切片运行契约。

尚未覆盖：真实生产 Admin origin/cookie 域部署和生产 Cloudflare secrets；部署前须按目标域名配置 `ADMIN_APP_ORIGIN`、`APP_BASE_URL`、`BETTER_AUTH_URL` 与 `BETTER_AUTH_SECRET`，再跑同等权限回归。
