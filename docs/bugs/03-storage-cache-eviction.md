# BUG-03: storage cache 驱逐不充分

**Severity**: Medium
**Location**: `src/server/handlers.ts:85-96`
**Type**: Cache Eviction

## 问题

缓存满时（`MAX_CACHE_SIZE=10`）只驱逐 1 个最旧 entry，但新 adapter 创建后会再次超过限制：

```typescript
if (storageCache.size >= MAX_CACHE_SIZE) {
  storageCache.delete(oldestKey);  // 只删 1 个
}
// 再次 check: size 可能仍 >= MAX_CACHE_SIZE
```

## 修复

改为 `while` 循环，直到有空间：

```typescript
while (storageCache.size >= MAX_CACHE_SIZE && storageCache.size > 0) {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [k, entry] of storageCache.entries()) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestKey = k;
    }
  }
  if (oldestKey) storageCache.delete(oldestKey);
  else break;  // 防止无限循环
}
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
