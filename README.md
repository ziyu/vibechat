# Vibe Chat

Vibe Chat 是一个以“氛围空间”为核心的新一代聊天产品。每个聊天房间由独立的氛围空间定义会话画布、消息呈现和互动方式。

当前仓库已经具备可运行的聊天宿主基础切片：四项主导航、会话列表、联系人、氛围发现、新建聊天、fixture 房间画布、消息本地回显与浏览器持久化。Matrix、Better Auth 和生产后端仍遵循设计文档中的独立评审边界，当前预览不会伪装这些服务已经接入。

## 当前技术基线

- 产品 Web 应用：React、TanStack Start、TanStack Router、Vite
- 工程组织：pnpm workspace、Turborepo
- 文档站：Fumadocs
- 后端、数据库、认证和定价：待前端骨架验收后重新评审

## 目录

```text
apps/
  web-app/     产品 Web 应用
  docs-app/    文档站
libs/          共享能力与界面基础
config/        共享配置
docs/          产品与技术文档
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
```

启动后访问 `http://localhost:7001/zh-CN/messages` 进入聊天预览；如果该端口已被其他本地服务占用，可以在 `apps/web-app` 下直接为 Vite 指定其他端口。

产品范围与架构决策见 [`docs/PRODUCT_AND_TECH_DESIGN.md`](docs/PRODUCT_AND_TECH_DESIGN.md)。
当前聊天宿主的实现范围与后续接入点见 [`docs/implementation/chat-host-foundation.md`](docs/implementation/chat-host-foundation.md)。
