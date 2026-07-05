# BUG-01: server 异步启动未等待

**Severity**: High
**Location**: `src/createStore.ts:47-53`
**Type**: Async Fire-and-Forget

## 问题

`createStore` 中对 `remote` 存储类型自动启动 server 时，使用 `import().then()` 的 fire-and-forget 模式：

```typescript
import('./server').then(({ startServer }) => {
  serverInitPromise = startServer().then(() => void 0).catch(...);
});
```

`createStore` 是同步函数，立即返回，但 server 可能尚未启动完成，导致后续 remote storage 操作立即失败。

## 修复

引入 module-level `serverInitPromise` 追踪启动状态，并导出 `waitForServer()` 供调用者等待：

```typescript
let serverInitPromise: Promise<unknown> | null = null;

export function waitForServer(): Promise<void> | undefined {
  return serverInitPromise as Promise<void> | undefined;
}
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
