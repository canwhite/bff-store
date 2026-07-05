# BUG-18: `storage.get` 失败时静默忽略

**Severity**: Low
**Location**: `src/atomCreator.ts:25-41`
**Type**: Silent Error

## 问题

`baseAtom.onMount` 中 `storage.get().catch(console.error)` 吞掉加载错误，开发者无法感知数据加载失败：

```typescript
.catch(console.error)  // 只打 console.error，无结构化日志
```

## 修复

添加包含 atom key 的错误信息：

```typescript
.catch((err) => {
  console.error(`[bff-store] Failed to load atom "${config.key}":`, err);
})
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
