# 登录后产品状态真实化实施记录

> 生命周期：开发中
> 文档类型：计划
> 状态：Complete（本切片）
> 更新日期：2026-08-22
> 维护范围：TanStack 聊天宿主、产品状态 API、用户偏好、官方空间目录与 E2E
> 稳定来源：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

> 演进说明：官方 Space 目录、收藏和 `favoriteSpaceIds` 是本切片已经验证的 2026-08-12 当前实现，也是 2026-08-22 [Space App 设计演进](./space-app-design-transition.md)必须保留的市场基线；后续只扩展模板与 App 能力，不删除本切片契约。

## 目标

登录后的 `/messages`、`/contacts`、`/discover`、`/me` 与 `/rooms/:roomId` 只呈现当前 Better Auth 用户、产品数据库和 Matrix/Synapse 的真实状态。认证、bootstrap 或 Matrix 不可用时必须失败关闭并显示明确的可恢复状态，不能再加载演示用户、演示联系人、演示房间或浏览器模拟 mutation。

## 切换前差距

- 聊天 provider 在未认证、bootstrap schema 错误、Synapse 未配置或 Matrix 启动失败时回落到 `createDemoChatState()`，使受保护产品页看起来仍可使用。
- 置顶、静音、通知、收藏空间等用户态只保存在组件 state 或 localStorage，没有产品数据库权威。
- 发现页从 fixture 读取空间资料和收藏数，静态卡片会被误认为已发布市场数据。
- 一些页面仍按 `fixture/matrix` 双模式分支执行本地建房、好友处理和消息修改。
- 当前错误文案仍引用“本地预览”，且聊天路由本身没有统一认证 guard。

## 实施边界

1. 聊天路由统一要求 Better Auth session；session 丢失后返回本地化登录页。
2. 客户端状态只有 `connecting/ready/unavailable/error`，删除登录后 fixture fallback 和本地模拟 action。
3. 产品数据库保存用户偏好、每房间置顶/静音和官方空间收藏；共享 service/repository 是唯一写入口。
4. 官方内置空间以服务端目录 API 返回，目录明确标识 `builtin` 与当前可用版本，不把未实现的第三方市场伪装成线上数据。
5. Matrix 房间、成员、timeline、read receipt、typing、媒体和关系事件继续以 Synapse 为权威。
6. 加载失败、Matrix 未配置和同步失败提供重试/退出入口；错误态不得暴露 token 或复用旧用户数据。
7. localStorage 只保留 Matrix SDK 允许的缓存和非权威界面缓存；产品偏好不以它为权威。

## 非目标

- 不在本切片实现第三方空间发布、审核、排行榜或 Runtime iframe。
- 不实现 Web Push 投递；只持久化用户是否愿意接收通知的产品偏好。
- 不实现 A3 capability、克隆迁移或空间私有状态。

## 完成条件

- [x] TEST-CATALOG #35 所有场景通过。
- [x] 仓库中登录后聊天代码不再导入 fixture，也不存在 fixture/local mutation 分支。
- [x] PostgreSQL 与 SQLite/D1 migration、共享单测、真实 Synapse 双用户 E2E 通过。
- [x] 类型检查、Web 生产构建、文档检查、Cloudflare workerd/D1 smoke 和浏览器人工走查通过。
- [x] 开发记录、当前重点、稳定参考和公开 API 文档同步反映真实边界。

## 验证证据

- 产品状态 service/repository 与 room 兼容单测：8/8。
- TEST-CATALOG #35：9/9 Chromium，覆盖 UI 注册、五个产品路由守卫、API 认证、Matrix unavailable 失败关闭、真实空账号、目录、收藏、用户/房间偏好、跨 session 持久化与跨账号隔离。
- 聊天真实链路全量回归：19/19 Chromium；包含 OTP、profile、social、room/timeline、完整消息操作、session 撤销/管理和本切片。
- 浏览器人工走查：桌面首次设置、空账号消息、服务端空间目录、我的偏好与 390×844 移动布局；无应用 error。
- `tsc --noEmit`、`pnpm build` 和 `node scripts/check-doc-links.mjs` 通过；workerd SSR 返回登录页 200，未登录 `/v1/product-state` 返回稳定 401，D1 `0009_tan_runaways.sql` 的 6 条命令成功应用。
- 完整 Vitest 基线：156 通过、6 个与本切片无关的既有失败（credits 常量数量、旧 user validator、email 默认 provider）；未作为本切片通过证据。
- 文档站 MDX 生成与链接检查通过；`next build` 仍受既有 `fumadocs-ui@16.2.5` 包内 `Sidebar*` 导出不一致影响，记录为非聊天阻断基线问题。
