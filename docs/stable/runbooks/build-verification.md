# 构建验证 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：产品应用、文档站和文档链接

## 文档变更

```bash
pnpm docs:check
pnpm build:docs
git diff --check
```

## 产品代码或共享库变更

```bash
pnpm typecheck
pnpm build
```

根目录 `pnpm build` 构建 `apps/web-app` 的 Cloudflare 目标。需要验证 Node.js 目标时运行：

```bash
cd apps/web-app
pnpm build:node
```

涉及 Workers 服务端代码或共享库时，再运行：

```bash
cd apps/web-app
pnpm preview:cf
```

然后访问终端给出的地址，检查首页、SSR 和至少一个相关 API。

## 功能变更

启动应用后运行对应 E2E：

```bash
pnpm dev
pnpm test:e2e -- <spec-file>
```

完整命令和结果需要记录在交付说明中。外部服务、凭据或本地环境导致的未覆盖项必须明确写出。

## 常见警告

- chunk size 警告不会自动使构建失败，但应在影响首屏或部署限制时拆包。
- `module.register()` 或依赖数据过旧警告来自依赖时，记录版本并在依赖升级任务中处理。
- Cloudflare ESM、绑定或重复 React 问题参见 `apps/web-app/CF-NOTES.md`。
