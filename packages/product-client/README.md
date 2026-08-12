# @vibechat/product-client

VibeChat 产品 API 的宿主无关 HTTP client。调用方可注入 API base URL 和 transport；Web 默认使用同源路径，Desktop 可注入独立 Backend origin 与认证 transport。

所有成功响应通过 `@vibechat/api-contracts` 解析，失败响应统一抛出 `ProductApiClientError`。
