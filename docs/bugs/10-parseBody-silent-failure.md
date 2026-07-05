# BUG-10: `parseBody` 失败静默忽略

**Severity**: Low
**Location**: `src/server/handlers.ts:159`
**Type**: Error Swallowing

## 问题

`resolveStorage` 中 `parseBody` 失败时静默忽略，导致 backend 配置丢失无法定位问题：

```typescript
try {
  body = await parseBody<Record<string, unknown>>(req);
} catch {
  // Ignore parse errors  ← 无日志
}
```

## 修复

添加 `console.warn` 记录：

```typescript
} catch {
  console.warn('[bff-store] Failed to parse request body, using URL config only');
}
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
