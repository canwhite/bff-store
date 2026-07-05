# BUG-17: `handleHealth` 未使用参数

**Severity**: Low
**Location**: `src/server/handlers.ts:240`
**Type**: Unused Parameter

## 问题

`handleHealth` 的 `req` 参数未使用：

```typescript
async function handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
```

## 修复

标记为 `_req` 明确表示未使用：

```typescript
async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
