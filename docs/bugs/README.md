# Bug 索引

Post-Mortem 2026-07-05 四轮审查共发现 **18 个 bug**，**15 个已修复**。

> High severity 文件名末尾标注 `.high`。

## 已修复

| # | Severity | File | Bug |
|---|----------|------|-----|
| 01 | High | [01-server-async-startup.high.md](./01-server-async-startup.high.md) | server 异步启动未等待 |
| 03 | Medium | [03-storage-cache-eviction.md](./03-storage-cache-eviction.md) | 缓存满时只驱逐 1 个 entry |
| 04 | Medium | [04-http-error-body-loss.md](./04-http-error-body-loss.md) | HTTP 错误响应 body 丢失 |
| 05 | Low | [05-debouncer-ms-ignored.md](./05-debouncer-ms-ignored.md) | debouncer ms 参数后续调用无效 |
| 07 | High | [07-jsonl-key-collision.high.md](./07-jsonl-key-collision.high.md) | JSONL key 碰撞导致数据覆盖 |
| 08 | Medium | [08-dead-code-getStorageForRequest.md](./08-dead-code-getStorageForRequest.md) | `getStorageForRequest` 死代码 |
| 09 | Low | [09-waitForLoad-infinite.md](./09-waitForLoad-infinite.md) | `waitForLoad` 无限等待 |
| 10 | Low | [10-parseBody-silent-failure.md](./10-parseBody-silent-failure.md) | `parseBody` 失败静默忽略 |
| 11 | High | [11-mongodb-storage-leak.high.md](./11-mongodb-storage-leak.high.md) | MongoDB `set` 无限积累旧版本 |
| 12 | High | [12-setEntityId-stale-closure.high.md](./12-setEntityId-stale-closure.high.md) | `setEntityId` 不生效（闭包捕获快照值） |
| 14 | Low | [14-dead-code-isServerRunning.md](./14-dead-code-isServerRunning.md) | `isServerRunning()` 未使用 |
| 15 | Medium | [15-unmount-data-loss.md](./15-unmount-data-loss.md) | unmount 时 pending writes 丢失 |
| 17 | Low | [17-unused-parameter.md](./17-unused-parameter.md) | `handleHealth` 未使用参数 |
| 18 | Low | [18-storage-get-silent-error.md](./18-storage-get-silent-error.md) | `storage.get` 失败时静默忽略 |

## 未修复（设计选择）

| # | Reason |
|---|--------|
| BUG-06 | module-level `debouncerMap` 通过 `entityId:key` 隔离键名，实际无跨 store 干扰 |
| BUG-13 | `createStorageFromTransport.get` 所有错误返回 null — 符合 storage graceful degradation 哲学 |
| BUG-16 | serverInitPromise 时序 — 符合 fire-and-forget 设计，`waitForServer()` 可供显式等待 |
| BUG-19 | GET 请求解析 body — 无害 no-op |
| BUG-20 | MongoDB 无复合索引 — 用户在数据库层处理 |
| BUG-21 | `setTimeout` unmount 后触发 — 无害 side effect |
