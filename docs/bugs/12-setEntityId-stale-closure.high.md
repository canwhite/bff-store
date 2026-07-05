# BUG-12: `setEntityId` 不生效（闭包捕获快照值）

**Severity**: High
**Location**: `src/storage/adapters/remoteStorage.ts:56`
**Type**: Stale Closure

## 问题

`RestStorageProtocol` 构造时传入 `entityId.current`（string）的快照值，后续 `setEntityId()` 更新 `entityId.current` 但 protocol 内部的 `getEntityId()` 仍读旧值：

```typescript
// remoteStorage.ts
const entityId = { current: options.entityId };
const protocol = new RestStorageProtocol(baseUrl, entityId.current, ...);  // ← 快照 string

// RestStorageProtocol.getEntityId()
return typeof this.entityId === 'object'
  ? this.entityId.current  // 只有 string，访问 .current 返回 undefined
  : this.entityId;
```

## 修复

传入 `{ current }` 对象引用而非字符串快照：

```typescript
const protocol = new RestStorageProtocol(baseUrl, entityId, ...);  // ← live 引用
```

`getEntityId()` 每次调用时动态读取 `this.entityId.current`。

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
