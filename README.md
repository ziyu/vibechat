# Vibe Chat

Vibe Chat 是一个以“氛围空间”为核心的新一代聊天产品。每个聊天房间由独立的氛围空间定义会话画布、消息呈现和互动方式。

当前仓库已经具备可运行的聊天宿主基础切片：四项主导航、会话列表、联系人、氛围发现、新建聊天、fixture 房间画布、消息本地回显与浏览器持久化。真实 Better Auth Email OTP、产品 profile 和可选的 Synapse Application Service identity bootstrap 已接入；房间 timeline 仍使用 fixture，未伪装成远端 Matrix 消息。

## 当前技术基线

- 产品 Web 应用：React、TanStack Start、TanStack Router、Vite
- 工程组织：pnpm workspace、Turborepo
- 文档站：Fumadocs
- 产品服务：TanStack Start server routes + 共享领域 service/repository
- 浏览器认证：Better Auth Email OTP（密码入口仅作迁移兼容）
- Matrix identity：可选 Synapse Application Service adapter；产品资料/映射支持 PostgreSQL 与 SQLite/D1

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
