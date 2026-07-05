# BUG-09: `waitForLoad` 无限等待

**Severity**: Low
**Location**: `src/nodeStore.ts:47-72`
**Type**: Infinite Wait

## 问题

`waitForLoad()` 使用 `setInterval` 轮询 loading atoms，无超时保护。若 storage 持续故障，promise 永不 resolve。

## 修复

添加 5s 超时，超时时 reject：

```typescript
async function waitForLoad(timeoutMs: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`waitForLoad timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const interval = setInterval(() => {
      if (!stillLoading()) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      }
    }, 10);
  });
}
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
