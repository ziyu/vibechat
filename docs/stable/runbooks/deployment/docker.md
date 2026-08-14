# Docker 部署 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：TanStack Start Node.js 构建目标的容器化

## 当前边界

仓库当前没有提交可直接发布的产品 Dockerfile。本 Runbook 定义容器镜像必须满足的契约；新增 Dockerfile 时应以本页和 Node.js 构建结果为验收依据。

## 镜像契约

1. 使用 Node.js 22 和 pnpm 9.4.0。
2. 以仓库根目录安装 workspace 依赖。
3. 运行 `pnpm --dir apps/web-app build:node`。
4. 运行入口是 `node apps/web-app/.output/server/index.mjs`。
5. 运行镜像只包含生产 artifact 与必要依赖，使用非 root 用户。
6. 密钥在容器启动时注入，不写入 Dockerfile、镜像层或构建参数。

## 本地验收

```bash
docker build -t vibechat-web .
docker run --rm -p 8001:8001 --env-file .env vibechat-web
curl -fsS http://localhost:8001/api/health
```

只有仓库加入实际 Dockerfile 后，上述命令才可执行。提交 Dockerfile 的同一变更必须补充镜像构建测试、健康检查、持久化数据库方案和回滚步骤。
