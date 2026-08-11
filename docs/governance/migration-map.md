# 文档结构迁移记录

> 文档类型：迁移记录
> 状态：生效
> 更新日期：2026-08-11
> 迁移范围：首轮仓库级文档治理

## 迁移摘要

| 原位置 | 新位置 | 分类 | 原因 |
| --- | --- | --- | --- |
| `docs/PRODUCT_AND_TECH_DESIGN.md` | `docs/stable/designs/vibechat-mvp-product-and-technical-design.md` | 长期稳定 / 设计 | 当前 VibeChat MVP 产品与技术基线 |
| `docs/implementation/affiliate-system.md` | `docs/stable/designs/affiliate-system.md` | 长期稳定 / 设计 | 按当前共享域和 TanStack API 重写 |
| `docs/implementation/auth-middleware-design.md` | `docs/stable/designs/auth-middleware.md` | 长期稳定 / 设计 | 改为当前 TanStack `beforeLoad` 与 API 授权设计 |
| `docs/implementation/configuration-system*.md` | `docs/stable/designs/configuration-system*.md` | 长期稳定 / 设计 | 改为 `config.ts` 与 `config/*` 的当前契约 |
| `docs/implementation/dynamic-pricing.md` | `docs/stable/designs/dynamic-pricing.md` | 长期稳定 / 设计 | 按当前 `libs/pricing` 和管理路由重写 |
| `docs/implementation/build-verification.md` | `docs/stable/runbooks/build-verification.md` | 长期稳定 / Runbook | 操作步骤不属于设计文档 |
| `docs/implementation/video-generation-provider-params-comparison.md` | `docs/stable/references/video-generation-provider-parameters.md` | 长期稳定 / 参考资料 | 参数对照属于查表资料 |
| `docs/user-guide/**` | `docs/stable/runbooks/**` | 长期稳定 / Runbook | 用户操作文档统一改为 Runbook |
| `docs/release/*` | `docs/stable/release-notes/*` | 长期稳定 / 发布说明 | 已发生的交付事实 |
| `ROADMAP.md` | `docs/stable/plans/product-roadmap.md` | 长期稳定 / 计划 | 用当前产品阶段重写旧路线图 |
| `TEST_PLAN.md` | `docs/stable/runbooks/testing/manual-and-api-testing.md` | 长期稳定 / Runbook | 改为可执行的手动与 API 测试步骤 |

中间迁移曾使用 `docs/archive/legacy-tinyship/` 和 `docs/stable-design/`，现已移除；它们不是最终文档入口。

## 保留在原位的文档

- `libs/*/README*.md`：与包实现一起维护。
- `*/AGENTS.md`：作为目录级开发约束原位保留。
- `tests/**`：测试目录、测试用例目录和执行说明原位保留。
- `apps/docs-app/content/**`：作为文档站发布内容原位保留。

## 后续工作

归档用户指南不会自动恢复。相关产品能力进入开发范围时，应以当前代码和稳定设计为基础，在 `docs/development/` 或 `apps/docs-app/content/` 重写，再按内容生命周期评审。
