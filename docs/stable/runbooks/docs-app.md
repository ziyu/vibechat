# 文档站 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：`apps/docs-app`

Vibe Chat 的 `docs-app` 是一个基于 [Fumadocs](https://fumadocs.dev) 构建的现代化静态文档站点，支持文档、博客和多语言内容。

## 📑 目录

- [特性概览](#特性概览)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [编写文档](#编写文档)
- [编写博客](#编写博客)
- [国际化](#国际化)
- [部署](#部署)

## 特性概览

- 🚀 **基于 Next.js 16** - 使用最新的 App Router
- 📝 **MDX 支持** - 在 Markdown 中使用 React 组件
- 🔍 **全文搜索** - 内置 Orama 静态搜索
- 🌐 **多语言** - 支持中英文切换
- 🎨 **主题系统** - 支持亮色/暗色模式
- 📦 **静态导出** - 可部署到任何静态托管服务

## 快速开始

### 开发模式

```bash
# 在项目根目录运行
pnpm dev:docs
```

访问 `http://localhost:3000` 查看站点。

### 构建

```bash
# 构建静态站点
pnpm build:docs

# 预览构建结果
python3 -m http.server 3000 --directory apps/docs-app/out
```

构建产物位于 `apps/docs-app/out` 目录。

## 项目结构

```
apps/docs-app/
├── app/
│   ├── [lang]/              # 语言路由
│   │   ├── (home)/          # 首页
│   │   ├── docs/            # 文档页面
│   │   └── blog/            # 博客页面
│   ├── api/                 # API 路由 (搜索)
│   └── layout.config.tsx    # 导航配置
├── content/
│   ├── docs/                # 文档内容
│   │   ├── index.en.mdx     # 英文首页
│   │   ├── index.zh-CN.mdx  # 中文首页
│   │   └── getting-started/ # 子目录
│   └── blog/                # 博客内容
│       ├── hello-world.en.mdx
│       └── hello-world.zh-CN.mdx
├── components/              # 组件
├── lib/                     # 工具函数
└── source.config.ts         # 内容配置
```

## 编写文档

### 创建新文档

1. 在 `content/docs/` 目录下创建 MDX 文件：

```bash
# 创建英文文档
touch content/docs/my-guide.en.mdx

# 创建中文文档
touch content/docs/my-guide.zh-CN.mdx
```

2. 添加 frontmatter 和内容：

```mdx
---
title: 我的指南
description: 这是一篇示例文档
---

## 介绍

这里是文档内容...
```

3. 更新 `meta.{lang}.json` 文件以控制侧边栏顺序：

```json
// content/docs/meta.zh-CN.json
{
  "title": "文档",
  "pages": [
    "index",
    "getting-started",
    "my-guide"
  ]
}
```

### 文档目录结构

对于子目录，需要创建对应的 `meta.{lang}.json`：

```
content/docs/
├── meta.en.json
├── meta.zh-CN.json
├── index.en.mdx
├── index.zh-CN.mdx
└── getting-started/
    ├── meta.en.json
    ├── meta.zh-CN.json
    ├── index.en.mdx
    └── index.zh-CN.mdx
```

## 编写博客

### 创建博客文章

在 `content/blog/` 目录下创建 MDX 文件：

```mdx
---
title: 我的第一篇博客
description: 这是博客文章的描述
author: Vibe Chat Team
date: 2024-12-19
category: 公告
---

## 正文

博客内容...
```

### 博客 Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 文章标题 |
| `description` | ❌ | 文章描述 |
| `author` | ✅ | 作者名称 |
| `authorRole` | ❌ | 作者职位 |
| `date` | ✅ | 发布日期 (YYYY-MM-DD) |
| `category` | ❌ | 文章分类 |

## 国际化

### 文件命名规范

所有内容文件使用语言后缀：

- `index.en.mdx` - 英文版本
- `index.zh-CN.mdx` - 中文版本

### 配置文件

`meta.json` 也需要语言后缀：

- `meta.en.json` - 英文配置
- `meta.zh-CN.json` - 中文配置

### 添加新语言

1. 更新 `config.ts` 中的语言配置
2. 创建对应语言的内容文件
3. 更新 `libs/i18n` 中的翻译

## 部署

### 静态托管

构建后的 `out` 目录可以部署到任何静态托管服务：

- **Vercel**: 直接连接 Git 仓库
- **Netlify**: 设置构建命令为 `pnpm build:docs`
- **GitHub Pages**: 上传 `out` 目录内容
- **Cloudflare Pages**: 类似 Vercel 的配置

### Vercel 配置示例

```json
// vercel.json
{
  "buildCommand": "pnpm build:docs",
  "outputDirectory": "apps/docs-app/out"
}
```

### 环境变量

确保设置以下环境变量：

```env
APP_BASE_URL=https://your-docs-site.com
```

## 自定义

### 修改导航

编辑 `app/layout.config.tsx` 添加导航链接。

### 修改主题

编辑 `app/global.css` 自定义样式变量。

### 添加组件

在 `components/` 目录下创建自定义组件，然后在 MDX 中使用。

## 常见问题

### 搜索不工作？

搜索功能需要构建后才能使用。在开发模式下，搜索可能不完整。

### 图片如何添加？

将图片放在 `public/` 目录下，使用绝对路径引用：

```mdx
![我的图片](/images/my-image.png)
```

### 如何添加代码高亮？

Fumadocs 内置代码高亮，直接使用 Markdown 代码块：

```typescript
const hello = "world";
```
