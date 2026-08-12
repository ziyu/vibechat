# @vibechat/api-contracts

VibeChat 浏览器客户端、Desktop 客户端与 Backend 共同使用的版本化 HTTP 契约。

- 只包含 Zod schema、DTO 和错误响应形状。
- 不依赖 React、路由、数据库、Better Auth server 或运行时环境变量。
- Backend 负责校验输入和输出；客户端负责解析成功响应。

通过包根入口或受控 subpath exports 导入，不允许跨包读取 `src/*`。
