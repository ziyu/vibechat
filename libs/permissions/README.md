# VibeChat 权限

Backend 内部 CASL 权限模块。当前活动能力是将 Better Auth 用户规范化为 `admin`/`user` 角色，并为所有 Admin API 提供统一授权判断。页面守卫不能替代服务端 `401`/`403`。
