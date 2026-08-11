# Vibe Chat

Vibe Chat 是一个以“氛围空间”为核心的新一代聊天产品。每个聊天房间由独立的氛围空间定义会话画布、消息呈现和互动方式。

当前仓库处于工程基线阶段，暂不进入业务功能开发。

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

产品范围与架构决策见 [`docs/PRODUCT_AND_TECH_DESIGN.md`](docs/PRODUCT_AND_TECH_DESIGN.md)。
