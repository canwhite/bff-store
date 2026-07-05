# BUG-04: HTTP 错误响应 body 丢失

**Severity**: Medium
**Location**: `src/storage/transport.ts:22-26`
**Type**: Error Info Loss

## 问题

`HttpTransport` 的 GET/POST/DELETE 在 HTTP 错误时只返回 `statusText`，丢失 server 返回的错误详情：

```typescript
if (!res.ok) {
  throw new Error(`GET ${url} failed: ${res.statusText}`);
  // 若 server 返回 { "error": "entity not found" }，此处只有 "Not Found"
}
```

## 修复

尝试读取响应 body 作为错误详情：

```typescript
if (!res.ok) {
  let detail = res.statusText;
  try {
    const body = await res.clone().json();
    detail = body?.error ?? body?.message ?? detail;
  } catch {
    // body is not JSON or unreadable
  }
  throw new Error(`GET ${url} failed: ${detail}`);
}
```

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
