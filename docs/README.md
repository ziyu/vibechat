# Vibe Chat 文档中心

仓库结构由三个内容生命周期目录和一个治理目录组成。治理目录负责定义规则，不是生命周期状态，文档不会流转到“文档治理”。

| 区域 | 目录 | 性质 | 可否作为实现依据 |
| --- | --- | --- | --- |
| 开发中 | [`development/`](./development/) | 内容生命周期：当前计划、提案、调研和仍在核验的运行说明 | 可以参考，但必须回到代码与稳定设计核验 |
| 长期稳定 | [`stable/`](./stable/) | 内容生命周期：已核验并持续维护的设计、Runbook、参考资料、发布说明和计划 | 可以，按文档类型确定其事实边界 |
| 已归档 | [`archive/`](./archive/) | 内容生命周期：被替代、已完成或与当前基线不一致的历史资料 | 不可以，只用于追溯背景 |
| 文档治理 | [`governance/`](./governance/) | 控制区：分类规则、迁移记录、模板和检查工具 | 可以，是文档维护规则的事实来源；不属于生命周期 |

## 建议阅读顺序

1. 先阅读[VibeChat MVP 版本产品与技术设计](./stable/designs/vibechat-mvp-product-and-technical-design.md)。
2. 再查看[VibeChat MVP 产品与技术设计 Active 实施跟踪](./development/active/product-and-technical-implementation.md)和[当前开发重点](./development/current-focus.md)。
3. 编写或迁移文档前，遵循[文档分类、生命周期与维护规范](./governance/lifecycle-policy.md)。
4. 只有需要调查历史决策时才进入归档区。

## 文档边界

- `docs/` 保存跨模块、跨应用的仓库级文档。
- `apps/docs-app/content/` 保存发布到文档站的用户内容；它不是设计事实来源。
- `libs/*/README*.md` 保存与包一起演进的使用说明。
- `*/AGENTS.md` 保存局部开发约束，不迁入 `docs/`。
- `tests/**` 保存测试目录、测试计划和执行说明，测试结果以实际测试与目录内记录为准。

同一事实只保留一个主文档。其他位置应链接到它，不应复制一份独立维护的正文。
