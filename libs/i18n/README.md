# VibeChat 国际化库

`libs/i18n` 保存产品应用共享的类型安全翻译资源。当前支持 `zh-CN` 和 `en`，配置来源是根目录 `config.ts` 的 `config.app.i18n`。

## 当前架构

产品应用使用无语言前缀的规范 URL：`/`、`/signin`、`/dashboard`。语言是请求偏好，不是资源身份的一部分。

解析优先级：

1. 有效的 `VIBECHAT_LOCALE` Cookie；
2. `autoDetect=true` 时的 `Accept-Language`；
3. `defaultLocale`。

TanStack 根路由在 SSR 阶段解析 locale，写入 route context 并设置 `<html lang>`。组件通过 `apps/web-app/src/hooks/use-translation.ts` 读取同一上下文，因此首屏与 hydration 使用同一种语言。切换语言只更新 Cookie 并刷新当前 URL，不改 pathname、query 或 hash。

旧 `/en/**` 和 `/zh-CN/**` 链接仅用于兼容：服务端确认语言、写入 Cookie，再 307 到无前缀规范路径。未知 `/fr/**` 等路径不会被猜测为语言并跳转。

文档站是内容型站点，可以独立使用语言化内容 URL；它不与产品路由共享上述约束。

## 使用

```tsx
import { useTranslation } from '@/hooks/use-translation'

function Example() {
  const { t, locale, changeLocale } = useTranslation()

  return (
    <>
      <h1>{t.header.navigation.ai}</h1>
      <button onClick={() => changeLocale(locale === 'en' ? 'zh-CN' : 'en')}>
        Switch
      </button>
    </>
  )
}
```

非 React 共享代码可以直接使用：

```ts
import { getTranslation, normalizeLocale, type SupportedLocale } from '@libs/i18n'

const locale: SupportedLocale = normalizeLocale(input) ?? 'zh-CN'
const t = getTranslation(locale)
```

## 新增文案或语言

新增文案时先改 `locales/en.ts`，再同步 `locales/zh-CN.ts`。英文文件是翻译结构的类型源。

新增语言还需要同步：

- `config.app.i18n.locales` 与默认值；
- 新 locale 文件及 `translations` 映射；
- `localeLabels`；
- 请求解析、旧链接兼容和 E2E 场景。

locale 只表示界面语言。市场、币种、支付可用性和时区必须使用独立字段与服务端规则，不能从 locale 推断授权。
