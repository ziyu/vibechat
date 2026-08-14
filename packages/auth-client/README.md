# @vibechat/auth-client

Web 与未来 Desktop 宿主共用的 Better Auth React client。包内只包含浏览器安全的认证调用、插件配置与 client factory；服务端 session、数据库 adapter 和 auth handler 仍由 `libs/auth` 管理。

默认导出的 `authClientReact` 使用宿主当前 origin。Desktop 或测试可通过 `createVibeAuthClient({ baseURL })` 注入 Backend 地址。
