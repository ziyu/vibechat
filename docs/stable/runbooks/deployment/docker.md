# Docker 部署 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-26
> 维护范围：TanStack Start Node.js 构建目标的容器化

## 当前边界

仓库通过 `apps/web-app/Dockerfile` 构建产品 Web 镜像，构建上下文必须是仓库根目录。本 Runbook 定义该镜像必须满足的契约，并以 CircleCI 的 `docker-build` job 和 Node.js 构建结果为验收依据。

## 镜像契约

1. 使用 Node.js 22 和 pnpm 9.4.0。
2. 以仓库根目录安装 workspace 依赖；执行冻结安装前必须复制根 `patches/`，确保 `pnpm.patchedDependencies` 引用的补丁存在于镜像构建上下文。
3. 运行 `pnpm --filter @vibechat/web-app run build:node`。
4. 运行镜像入口是 `node .output/server/index.mjs`。
5. 运行镜像只包含生产 artifact 与必要依赖，使用非 root 用户。
6. 密钥在容器启动时注入，不写入 Dockerfile、镜像层或构建参数。

## 本地验收

```bash
docker build -t vibechat-web -f apps/web-app/Dockerfile .
docker run --rm -p 8001:8001 --env-file .env vibechat-web
curl -fsS http://localhost:8001/api/health
```

Dockerfile 或 workspace 安装输入发生变化时，必须同时通过镜像构建测试；运行部署还需核验健康检查、持久化数据库方案和回滚步骤。
