# Space Template 版本规则

> 生命周期：长期稳定
> 文档类型：参考资料
> 状态：生效
> 更新日期：2026-08-25
> 维护范围：官方与用户 Space Template 的版本签发、市场展示、兼容性和仓库目录校验

## 1. 范围与版本边界

市场中的官方 Template 和用户 Template 共用同一套 [SemVer](https://semver.org/) 版本规则。`SpaceTemplateVersion.semanticVersion` 只描述一次不可变 Template 发布，不表示开发迭代次数，也不与下列版本联动：

- `vibechat.space-template/v1` 等协议 schema 版本；
- Space App SDK 与 Runtime 兼容版本；
- 某个 Space 的 Project Revision、ready Revision 或 Published Release；
- 仓库提交、构建次数、codegen 次数、市场排序或展示文案修改。

Template ID 与 Version ID 是稳定身份；SemVer 是面向市场和升级判断的有序版本。官方 Version ID 采用 `tplv-<template-id>-<major>-<minor>-<patch>`，用户发布可以使用服务端生成的 opaque ID，但必须遵循相同的 SemVer 序列。

## 2. 起始版本与升版规则

新 Template 的第一个可发布版本固定为 `0.1.0`。`0.x` 表示协议和产品仍在正式 `1.0.0` 之前，不允许因为完成了一轮开发就把主版本增加一次。达到生产发布门槛并经过明确发布决策后，才可从最后一个 `0.x` 版本进入 `1.0.0`。

| 变化 | `1.0.0` 前 | `1.0.0` 后 | 示例 |
| --- | --- | --- | --- |
| 兼容的缺陷修复，不改变已有调用和权限语义 | patch + 1 | patch + 1 | `0.1.0 → 0.1.1` |
| 向后兼容的新 UI/交互/能力 | minor + 1，patch 归零 | minor + 1，patch 归零 | `0.1.1 → 0.2.0` |
| 破坏已有 Project、SDK 调用、状态或权限假设 | minor + 1，patch 归零 | major + 1，minor/patch 归零 | `0.2.3 → 0.3.0`；`1.4.2 → 2.0.0` |

每次发布只能走一个相邻步骤：patch、minor 或 major 中只能增加一项且其低位归零。禁止 `0.1.0 → 0.1.3`、`0.1.0 → 0.3.0`、倒序、重复版本和非规范的 `v1`、`1.0`、`01.0.0`。

## 3. 什么时候允许升版

只有不可变版本载荷发生实际变化时才允许创建新 Template Version：

- App Project source 或构建产物发生变化；
- `projectFormat`、Space App SDK/Runtime compatibility 发生变化；
- permissions、network domains 等 capabilities 发生变化；
- 上述变化对应的 provenance 与签名/完整性记录发生变化。

以下变化不升 Template 版本：

- Template 名称、介绍、市场分类、排序、收藏数、审核展示或文档修订；
- 只重新运行 codegen、重新索引或重启服务；
- 不改变 Template source/contract 的 Kernel、Chat Core、Backend 或 Runtime 修复；
- 某个 Space 在复制模板后由成员或 Agent 产生的 Project Revision/Release；
- 对完全相同载荷的重复构建或重复发布请求。

没有载荷变化时应复用现有 Version；不能通过空升版制造“更新”。已发布 Version 不得原地修改或删除，任何载荷变化都必须创建符合规则的新版本。

## 4. 发布门禁

官方仓库 codegen 与用户发布服务必须执行相同的顺序校验：

1. SemVer 必须是规范的 `major.minor.patch`；首版必须为 `0.1.0`。
2. Versions 按 SemVer 严格升序保存；相邻项不得跳号。
3. `currentVersionId` 必须指向序列中的最高版本。
4. 相邻版本的不可变载荷不得完全相同。
5. 已发布 Version 的 source/manifest lock 不匹配时拒绝覆盖，要求签发下一合法版本。

官方目录额外要求 `releases.json` 按 SemVer 严格升序追加，Version ID 与 Template ID/SemVer 一致，唯一多文件 `app/` 工作项目的完整文件树 hash 必须等于最新 Release 的 artifact lock。Canonical hash 保持三个历史必需入口的既有顺序，再按 POSIX path 排序其余文件，因此旧三文件 Space 的 hash 不变；`package.json`、`tsconfig.json` 与 `src/index.ts` 只是必需入口，不能把协议实现成只处理三个固定文件。`development` 基线可在正式发布前受控重签；`published` 记录不可重签。仓库不得用 SemVer 建源码目录；历史 Version 引用 Registry/Object Store 中的不可变 artifact，并保留可重建它的固定 Git revision。市场 UI 只展示实际 `semanticVersion`，不得从 schema、commit 或历史开发 alias 推导一个更大的版本号。

## 5. 当前基线纠正与兼容

2026-08-24 前的开发实现把协议迁移轮次误写成官方 Template `5.0.0`。这些条目尚未作为生产市场版本发布，因此一次性纠正为首个有序基线 `0.1.0`；这不是对已发布版本的降级或改写。

本地开发数据中旧的 `builtin-<template>-v1..v5` 和 `tplv-<template>-5-0-0` 只作为读取 alias 解析到当前官方版本；当前五个官方 Template 的有序序列为 `0.1.0 → 0.1.1 → 0.1.2`。`0.1.1` 只修正 App Project 的 AgentOS Release 入口导出；`0.1.2` 在不改变 SDK、权限、App State 或 Chat Core 语义的前提下，修正全屏 Chat Header 与 Composer 布局，并把 App/Chat 浏览器逻辑和 CSS 拆为可类型检查、按职责维护的模块。两次源码载荷都实际变化，均按兼容缺陷修复相邻提升 patch。新创建的 Space 和市场响应只写当前规范 Version ID。正式市场发布后不得再用 alias 或基线纠正覆盖不可变历史。
