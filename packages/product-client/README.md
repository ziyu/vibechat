# @vibechat/product-client

VibeChat 产品 API 的宿主无关 HTTP client。调用方可注入 API base URL 和 transport；Web 默认使用同源路径，Desktop 可注入独立 Backend origin 与认证 transport。

所有成功响应通过 `@vibechat/api-contracts` 解析，失败响应统一抛出 `ProductApiClientError`。

Space App 版本能力通过同一成员作用域 client 暴露：

- `getSpaceProjectRevisions(matrixRoomId)` 读取最多 50 条不可变 Revision 摘要；响应不包含源码或 Object Store key。
- `restoreSpaceApp(matrixRoomId, input)` 支持恢复 Default Chat，也支持以 `target: "revision"`、固定 `revisionId` 和 `expectedReadyRevisionId` 恢复历史版本。
- 历史恢复只移动当前 ready pointer，不改变已发布 Release、Matrix timeline、成员或 App State；服务端仍会重新执行 Candidate 校验。
