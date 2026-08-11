# 文档与交付验证标准

> 文档类型：治理规则
> 状态：生效
> 更新日期：2026-08-11

## 文档变更

至少执行：

```bash
pnpm docs:check
pnpm build:docs
```

`docs:check` 检查非归档 Markdown/MDX 中的仓库内相对链接，并校验稳定正文的生命周期与文档类型是否匹配目录。归档区被有意排除，因为它保存历史原貌。

## 代码或配置变更

除文档检查外，按仓库根目录 `AGENTS.md` 执行：

```bash
pnpm typecheck
pnpm build
```

用户可访问功能还需要运行对应的 TanStack E2E 用例。涉及服务端或共享库时，按 `apps/web-app/CF-NOTES.md` 验证 Cloudflare 预览。

## 结果记录

交付说明应记录实际运行的命令、结果和未覆盖项。不要用“应当通过”代替实际执行结果。
