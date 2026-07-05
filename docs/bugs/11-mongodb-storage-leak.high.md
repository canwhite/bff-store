# BUG-11: MongoDB `set` 无限积累旧版本

**Severity**: High
**Location**: `src/storage/mongodb.ts:63`
**Type**: Storage Leak

## 问题

`set` 使用 `insertOne` 每次都插入新 document，从不清理旧版本：

```typescript
await collection.insertOne({
  key, value, timestamp: Date.now(), entityId: currentEntityId,
});
// 每次 set 都插入新行，旧版本永远存在 → collection 无限膨胀
```

`remove` 使用 `deleteMany` 留下 tombstone（空 collection 仍存在）。

## 修复

改用 `updateOne` + `upsert: true` 原地更新：

```typescript
await collection.updateOne(
  { key, entityId: currentEntityId },
  { $set: { value, timestamp: Date.now() } },
  { upsert: true }
);
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
