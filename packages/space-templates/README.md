# Space Templates

`@vibechat/space-templates` 定义官方和用户 Space Template 共用的发布协议。Template 不是正在运行的 Space，也不是多个 Space 共用的工作目录；市场发布的是不可变 **Template Version**。应用版本时，Runtime 把它复制成目标 `spaceInstanceId` 独享的 App Project，后续 Agent/人工 Revision 不会修改市场版本。

## 一个协议，两种创作入口

官方和用户 Template 在市场、Space 创建和 Runtime 中使用相同结构：

- `vibechat.space-template/v1`：Template identity、slug、Publisher、展示信息和当前版本指针。
- `vibechat.space-template-version/v1`：不可变版本、App Project 格式、SDK/Runtime 兼容性、capabilities 和 provenance。
- `vibechat.space-template-artifact/v1`：按源码 hash 寻址的不可变 App artifact 引用；Version 不内联工作源码。
- `vibechat.space-template-market-entry/v1`：市场读取的统一快照；不存在 `builtin` 类型或官方专用字段。
- `publisher.verification`：`official | verified | unverified`；“官方”只是 Publisher 的验证状态，不是另一套 Template 类型。
- `provenance.origin`：官方仓库发布为 `repository`，用户从 Space App 发布为 `app`。两者最终生成相同的 source/manifest hash、integrity、版本和市场条目。

差异只在创作与交付入口：

| 来源 | 创作事实入口 | 进入市场的方式 |
| --- | --- | --- |
| 官方 | 本包 `official/<template-id>/`，由 Git 评审、版本锁和 codegen 管理 | 构建时生成统一 Market entry，Publisher 标记为 `official` |
| 用户 | 某个 Space 的固定 ready Revision | 通过 App 内发布功能提交，Backend 复制源码快照、审核并写入 Product DB/Object Store；Publisher 使用该用户/组织身份 |

用户发布、审核和生产存储链路尚未完成；当前代码已经提供共用协议、`app` provenance 校验和可注入 Market entry 边界，不能把这些基础能力描述成第三方发布 API 已上线。

## 官方目录结构

```text
packages/space-templates/
├── official/
│   └── <template-id>/
│       ├── template.json
│       ├── CHANGELOG.md
│       ├── releases.json
│       └── app/
│           ├── package.json
│           ├── space-app-dependencies.json # exact managed package integrity（按需）
│           ├── tsconfig.json
│           └── src/
│               ├── index.ts        # 仅启动 Runtime、装配 fetch handler
│               ├── runtime.ts      # RivetKit actor/registry
│               ├── page.ts         # HTML document composition
│               ├── browser/        # App 内 SDK 视图类型、HTML 与模块脚本装配
│               ├── app/            # Template 自身的 markup/style/type-checked controller
│               └── chat/           # Chat client、message、composer 与分区 styles
├── scripts/generate-official-catalog.mjs
└── src/
    ├── registry.ts
    ├── node.ts
    ├── official-catalog.generated.ts
    └── index.ts
```

每个官方 Template 只有一份持续演进的普通多文件 `app/` 项目。`src/index.ts` 只是入口，不承载整页 HTML/CSS/浏览器脚本；Runtime、文档装配、Template App 与默认 Chat UI 按职责拆分。浏览器行为必须以可单独阅读和严格类型检查的 controller/functions 维护，再由 App 内部模块脚本装配器输出；Chat 的 DOM 绑定、消息投影、Composer、启动订阅和 CSS 分区不能重新压成单行巨型字符串或一个共享状态机。Chat UI 是可修改的 App 代码，Chat Core、Matrix 会话语义、mention 与 `@agent` 调度仍由 Kernel/SDK 契约保证。

包级 `src/` 只维护协议、Registry、artifact provider 与生成目录，不维护 `chat-core.ts` 或任何可渲染的 Default Chat fallback。Default Chat UI 只能存在于 `official/space-default/app/` 的 Template Project 中；网络、Runtime 或构建失败必须保持真实错误，由 Kernel 继续加载最后 ready Revision 或显式创建恢复 Revision，不能由共享包临时拼出另一套页面。

`releases.json` 是扁平、追加式的发布索引，只保存 Version manifest、release status、source/manifest lock 和 content-addressed artifact 引用，不复制历史源码。`development` 记录可在正式发布前重签同一开发基线；切换为 `published` 后不可重签。已发布历史由 Template Registry/Object Store 中的不可变 artifact 保存，并可由固定 Git revision 重建；仓库 Git 历史负责审查源码演进。

`official-catalog.generated.ts` 只生成当前市场所需的 Template/Version/Artifact 元数据，不包含 App 源码。开发环境的 Node artifact provider 从当前 `app/` 读取源码并验证 hash；生产 Runtime 必须按同一个 artifact ID 从 Registry/Object Store 获取。

Template 引用平台组件时使用普通、语义化 package specifier：正常浏览器构建按领域使用 `@vibechat/space-app-components/user`、`/chat` 或 `/recipes`；当前返回自包含 HTML 的 `agentos-app-v1` Template 按需使用明确的 `/user/inline`、`/chat/inline` 或 `/recipes/inline` delivery adapter。inline entry 与普通领域 entry 属于同一个精确 package version/integrity，不是第二套组件 API。`package.json` 必须声明精确版本，`space-app-dependencies.json` 必须声明同版本的 managed integrity；不能引用 `/artifacts/*`、版本目录、仓库路径，也不能提交 `src/vendor` 组件副本、`vendor/vibechat-packages` 或 `vibechat.resolved-dependencies.json`。Runtime 只在隔离的 prepared build 中生成 revision-local `file:` dependency，并把 prepared artifact 与 source object 分开持久化，因此 Template working source、既有 ready Revision 和 Published Release 不被在线 Registry 漂移改写。

## 不变量

1. 已签发的 `templateVersionId` 不得原地修改 source、capabilities、compatibility、Publisher 或 provenance。
2. `sourceHash` 来自完整 Project 文件树的规范化 SHA-256：先保持 `package.json`、`tsconfig.json`、`src/index.ts` 的历史 canonical 顺序以兼容已有 Space，再按相对 POSIX path 排序其余文件。这三个文件是必需入口，不是文件白名单。任一嵌套模块或资源变化都会改变 hash；路径穿越、绝对路径、构建输出、依赖目录和符号链接被拒绝。
3. 每个官方 Release 必须在 `releases.json` 保存 source/manifest lock。历史锁不一致意味着正在改写已发布记录，必须拒绝；当前 `app/` 只允许与最新 Release 一致，或正在准备下一个 Release。
4. `createSpaceTemplateVersion()` 是官方与用户发布共用的版本签发原语：仓库来源必须有 `sourcePath`，App 来源必须有固定 `sourceSpaceRevisionId`。
5. `createSpaceTemplateMarketEntry()` 对两种来源生成相同市场结构；消费者只能根据 Publisher verification 展示官方/认证标记。
6. Space 创建后同时保存 Template lineage hash 与当前 Project hash；Runtime 初始化不得隐式升级现有 Project。模板升级必须创建独立 Candidate，验证成功后由显式操作切换，任何 Agent/人工修改都不会被覆盖。
7. Matrix 只保存 Template/Project/Release 指针和安全快照，不保存源码或构建产物。
8. `agentos-app-v1` 的 `src/index.ts` 必须导出 RivetKit `registry`、调用 `registry.start()` 并默认导出 fetch handler；Dev Preview 与不可变 Release 使用同一入口契约。
9. managed dependency 只允许 exact version + exact `sha256:` integrity；Registry unavailable、版本/hash 不一致或 source 占用生成目录时，新 Candidate 必须失败并保留最后 ready Revision/Release。

## 发布官方新版本

1. 直接在 `official/<template-id>/app/` 演进源码并更新 `CHANGELOG.md`；不要创建版本源码目录。
2. 从固定 Git revision 构建 `agentos-app-v1` artifact，计算 content hash，上传统一 Template Registry/Object Store。
3. 为新版本分配新的 `tplv-*` ID，在扁平 `releases.json` 末尾追加 manifest/lock/artifact 记录，并把 `template.json.currentVersionId` 指向它；不得覆盖旧记录。
4. 最新且显式标为 `development` 的记录可在正式发布前运行 `pnpm --filter @vibechat/space-templates lock:development` 受控重签；正式发布时将 status 固化为 `published`。后续源码载荷变化必须先按规则追加相邻 SemVer，再用 `lock:new` 为最新未签发记录计算 lock，并运行 `generate`。`check:generated` 会拒绝已发布记录漂移、顺序/ID 错误、空升版、最新源码与 artifact hash 不一致和陈旧 catalog。
5. 运行 Template/Runtime/Product State tests、文档检查、typecheck、build 和适用的 Matrix/Space App E2E。

若某个 Template 需要独立发布部署，发布器使用该 Version 引用的 immutable artifact，而不是检出一个版本源码目录。官方发布器以固定 Git revision 的 `app/` 为 build context；用户发布器以固定 ready Revision 为 build context。两者产生同样的 artifact、SBOM、provenance 和 Registry 记录，也都不得从 generated catalog 反向恢复源码。

## 当前存储事实与后续边界

- 官方 Template working source：Git 仓库中每个 `official/<template-id>/app/` 的唯一项目树。
- Template release artifact：统一 Registry/Object Store 中按 hash 寻址的不可变快照；仓库不保存逐版本源码副本。
- 当前官方 Market adapter：`officialSpaceTemplateMarketEntries`；`/v1/spaces` 已按统一 Market schema 返回它们。
- Space Project：Product DB 保存 Project/Revision/Release 元数据和指针；Backend 私有 Object Store 保存按 hash 寻址的 source。开发环境使用 SQLite 和 Backend 忽略目录下的 Object Store adapter，但经过同一内部 HTTP 契约。
- 后续生产边界：Product DB 继续扩展 Template/Version/Publisher/审核元数据；Object Store 扩展不可变 artifact、SBOM 与 provenance。
- 用户发布目标：从固定 ready Revision 创建不可变 Template Version，完成隐私清理、权限/兼容性校验和审核后，与官方条目一起进入同一市场查询。
