# 配置系统设计

> 生命周期：长期稳定
> 文档类型：设计
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：`config.ts`、`config/*`、`env.example`

## 目标

Vibe Chat 使用一个共享配置契约，同时服务 TanStack Start 产品应用、共享库和文档站。静态默认值与环境变量解析集中管理，业务代码不直接散落读取 `process.env`。

## 结构

| 位置 | 职责 |
| --- | --- |
| `config.ts` | 组合应用、品牌和各业务域配置，对外导出 `config` |
| `config/*.ts` | 认证、支付、积分、数据库、存储、AI、返利等域配置 |
| `config/types.ts` | 跨域共享配置类型 |
| `config/utils.ts` | `getEnv`、必需变量读取和服务级错误信息 |
| `env.example` | 可配置环境变量的无密钥示例 |

应用和共享库通过 `@config` 导入统一配置：

```ts
import { config } from '@config'

const appName = config.app.name
const affiliateEnabled = config.affiliate.enabled
```

## 设计规则

1. 品牌、语言、主题和静态产品选项放在 `config.ts` 或相应域配置中。
2. 密钥和部署差异通过环境变量提供；仓库只提交 `env.example`。
3. 新业务域先创建 `config/<domain>.ts`，再由 `config.ts` 组合导出。
4. 配置读取需要默认值时，默认值必须在一个位置定义。
5. 客户端代码不能接触服务端密钥；公开值需要显式进入客户端安全的配置或构建变量。
6. 不为同一个值增加多个环境变量别名，除非有明确迁移期和删除计划。

## 添加配置的流程

1. 判断它是静态产品选择还是部署环境差异。
2. 在对应的 `config/*.ts` 增加类型安全的字段。
3. 如需环境变量，同步更新 `env.example`，不要填写真实值。
4. 在使用方通过 `@config` 读取，不在路由中重复解析。
5. 为必需变量补充清晰的服务名称和失败信息。
6. 运行 `pnpm typecheck` 与 `pnpm build`；涉及 Cloudflare 绑定时再运行 `apps/web-app` 的 CF 预览。

## 变更边界

- 删除或改名配置键属于契约变更，需要同步所有 `libs/*` 和 `apps/web-app` 使用方。
- 改变默认值可能影响新部署和测试，必须在交付说明中明确。
- Provider 参数归一化属于共享域逻辑，不应全部塞进顶层 `config.ts`。

英文版本见 [Configuration System Design](./configuration-system.en.md)。
