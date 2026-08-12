# Vibe Chat

Vibe Chat 是一个以“氛围空间”为核心的新一代聊天产品。每个聊天房间由独立的氛围空间定义会话画布、消息呈现和互动方式。

当前仓库已经具备可运行的聊天宿主和真实基础闭环：Better Auth Email OTP、首次资料设置、产品 profile、好友请求/联系人/私有备注/屏蔽、Synapse Application Service identity、session/device 撤销、参与者 ACL、幂等 Matrix 建房与邀请均已接入。浏览器使用 `matrix-js-sdk` 完成 `/sync`、IndexedDB timeline 缓存、transaction local echo、文字/媒体、回复、回应、编辑、删除、typing、历史搜索和离线重发；“我的”可热更新资料、管理浏览器会话和清理本地 Matrix 缓存。Synapse 未配置、用户未登录或 bootstrap 失败时显式失败关闭，不加载 fixture 或浏览器模拟状态。

## 当前技术基线

- 产品 Web 应用：React、TanStack Start、TanStack Router、Vite
- 公开官网：独立 TanStack Start 应用
- 运营后台：独立 TanStack Start 应用，复用共享 Backend Admin API
- 共享后端：独立 TanStack Start server runtime；Web 通过同源网关接入
- 工程组织：pnpm workspace、Turborepo
- 文档站：Fumadocs
- 产品服务：TanStack Start server routes + 共享领域 service/repository
- 浏览器认证：Better Auth Email OTP（密码入口仅作迁移兼容）
- Matrix identity：可选 Synapse Application Service adapter；产品资料/映射支持 PostgreSQL 与 SQLite/D1
- Matrix timeline：`matrix-js-sdk` 单例、IndexedDB sync cache、标准消息/媒体/关系/typing 与失败重发；access token 不写入 localStorage

## 目录

```text
apps/
  site-app/    官网与公开内容（8003）
  web-app/     产品 Web/PWA（8001）
  backend/     Auth、产品 API 与上传（8002）
  admin-app/   运营后台与后续空间审核（8005）
  docs-app/    文档站
packages/
  api-contracts/       Web、Backend、Desktop 共用 API schema
  auth-client/         浏览器安全的 Better Auth React client
  product-core/        宿主无关的产品状态与用例
  product-client/      可注入 origin/transport 的 HTTP client
  matrix-client/       Matrix SDK 生命周期与产品投影
  platform-contracts/  浏览器/Desktop 宿主能力端口
  i18n/                跨应用翻译契约
  validators/          跨应用输入校验
  ui/                  主题、图标与样式契约
  react-shared/        跨 React 应用组件、hooks 与 provider
libs/          单一 Backend 内部领域实现与尚未升级的通用能力
config/        共享配置
docs/          按分类与生命周期治理的产品与技术文档
tests/         单元、API 与端到端测试
```

## 常用命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm dev:docs
pnpm build:docs
# 可选：启动本地 Synapse 并运行真实 adapter 合约
npm run matrix:dev:init
npm run matrix:dev:up
npm run test:matrix:integration
```

`pnpm dev` 同时启动四项活动服务：访问 `http://localhost:8003/zh-CN` 查看官网，访问 `http://localhost:8001/zh-CN/messages` 进入聊天产品，访问 `http://localhost:8005/zh-CN/admin` 进入运营后台；`http://localhost:8002` 是独立 Backend，浏览器业务经各自应用的同源网关访问。

文档入口见 [`docs/README.md`](docs/README.md)，产品范围与架构决策以[VibeChat MVP 版本产品与技术设计](docs/stable/designs/vibechat-mvp-product-and-technical-design.md)为准。
当前聊天宿主的实现范围与后续接入点见[聊天宿主基础实现](docs/stable/references/chat-host-foundation.md)。
本地真实 Matrix identity 联调见[本地 Synapse 开发环境](docs/stable/runbooks/local-synapse.md)。
