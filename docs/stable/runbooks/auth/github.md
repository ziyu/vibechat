# GitHub OAuth Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：GitHub OAuth

本文档介绍如何配置 GitHub OAuth 社交登录。

## 📑 目录

- [设置步骤](#设置步骤)
- [环境变量配置](#环境变量配置)
- [回调地址说明](#回调地址说明)

## 设置步骤

1. 访问 [GitHub OAuth Apps](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写应用信息
4. 设置回调 URL

## 环境变量配置

在 `.env` 文件中添加：

```env
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
```

## 回调地址说明

**本地开发环境**：
```
http://localhost:8001/api/auth/callback/github
```

**生产环境**：
```
https://yourdomain.com/api/auth/callback/github
```

---

返回 [认证配置概览](./overview.md)
