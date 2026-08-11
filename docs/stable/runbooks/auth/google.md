# Google OAuth Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：Google OAuth

本文档介绍如何配置 Google OAuth 社交登录。

## 📑 目录

- [设置步骤](#设置步骤)
- [环境变量配置](#环境变量配置)
- [回调地址说明](#回调地址说明)

## 设置步骤

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 在"API 和服务 > 凭据"中创建或编辑 OAuth 2.0 客户端 ID。[Google API Credentials](https://console.cloud.google.com/apis/credentials)
3. 在"授权的 JavaScript 来源"中添加 http://localhost 或 http://127.0.0.1。
4. 在"授权的重定向 URI"中添加具体的回调地址

## 环境变量配置

在 `.env` 文件中添加：

```env
GOOGLE_CLIENT_ID="your_google_client_id.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

## 回调地址说明

**本地开发环境**：
```
http://localhost:7001/api/auth/callback/google
```

**生产环境**：
```
https://yourdomain.com/api/auth/callback/google
```

在 Google Cloud Console 中，需要将这些地址添加到"授权的重定向 URI"中。

---

返回 [认证配置概览](./overview.md)
