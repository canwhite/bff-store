# BUG-15: unmount 时 pending writes 丢失

**Severity**: Medium
**Location**: `src/atomCreator.ts:25-41`
**Type**: Data Loss

## 问题

`baseAtom.onMount` 未返回 cleanup 函数，组件卸载时 pending debounced writes 仍在计时器队列中：

1. 用户快速编辑 → 触发多个 debounced writes
2. 组件卸载（如路由切换）→ pending writes 仍在队列
3. 计时器触发时，`getDefaultStore()` 在已销毁的上下文中被调用
4. 数据写入丢失

## 修复

`onMount` 返回 cleanup 函数取消 pending writes：

```typescript
baseAtom.onMount = (setValue) => {
  storage.get<T>(config.key)
    .then((value) => { if (value != null) setValue(value); })
    .catch((err) => { console.error(`[bff-store] Failed to load atom "${config.key}":`, err); })
    .finally(() => { /* loadingAtom = false */ });

  return () => {
    const debounceKey = `${entityId}:${config.key}`;
    debouncerMap.cancel(debounceKey);
  };
};
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
