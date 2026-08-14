# @vibechat/matrix-client

VibeChat 对 `matrix-js-sdk` 的共享生命周期、消息操作和产品状态投影层。

调用方必须显式注入 IndexedDB 能力；包不再直接读取 `window`，因此 Web 与未来 Desktop 可选择各自 storage adapter。
