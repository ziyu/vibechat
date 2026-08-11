# Vibe Chat

Vibe Chat 是一个以“氛围空间”为核心的新一代聊天产品。每个聊天房间由独立的氛围空间定义会话画布、消息呈现和互动方式。

当前仓库已经具备可运行的聊天宿主和真实消息纵向链路：Better Auth Email OTP、产品 profile、Synapse Application Service identity、session/device 撤销、幂等 Matrix 建房与产品索引均已接入。浏览器使用 `matrix-js-sdk` 完成 `/sync`、IndexedDB timeline 缓存、transaction local echo、消息、回复和回应；Synapse 未配置或用户未登录时才显式退回 fixture 预览。

## 当前技术基线

- 产品 Web 应用：React、TanStack Start、TanStack Router、Vite
- 工程组织：pnpm workspace、Turborepo
- 文档站：Fumadocs
- 产品服务：TanStack Start server routes + 共享领域 service/repository
- 浏览器认证：Better Auth Email OTP（密码入口仅作迁移兼容）
- Matrix identity：可选 Synapse Application Service adapter；产品资料/映射支持 PostgreSQL 与 SQLite/D1
- Matrix timeline：`matrix-js-sdk` 单例、IndexedDB sync cache、标准消息关系；access token 不写入 localStorage

## 目录

```text
apps/
  web-app/     产品 Web 应用
  docs-app/    文档站
libs/          共享能力与界面基础
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

启动后访问 `http://localhost:7001/zh-CN/messages` 进入聊天预览；如果该端口已被其他本地服务占用，可以在 `apps/web-app` 下直接为 Vite 指定其他端口。

文档入口见 [`docs/README.md`](docs/README.md)，产品范围与架构决策以[VibeChat MVP 版本产品与技术设计](docs/stable/designs/vibechat-mvp-product-and-technical-design.md)为准。
当前聊天宿主的实现范围与后续接入点见[聊天宿主基础实现](docs/stable/references/chat-host-foundation.md)。
本地真实 Matrix identity 联调见[本地 Synapse 开发环境](docs/stable/runbooks/local-synapse.md)。
