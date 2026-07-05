# BUG-07: JSONL key 碰撞导致数据覆盖

**Severity**: High
**Location**: `src/storage/jsonl.ts:32`
**Type**: Key Collision

## 问题

`getFilePath` 将所有非字母数字字符替换为 `_`：

```typescript
const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
// "user.name" → "user_name"
// "user-name" → "user_name"  ← 碰撞！
```

## 修复

改用 `encodeURIComponent` 生成碰撞安全的文件名：

```typescript
const safeKey = encodeURIComponent(key);
// "user.name" → "user.name"  (实际 "user%2Ename")
// "user-name" → "user-name"
// "user name" → "user%20name"
```

## 验证

- Build: ✅
- Tests: ✅ (11 jsonl tests passed，含碰撞回归测试)
