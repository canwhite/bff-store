# BUG-08: `getStorageForRequest` 死代码

**Severity**: Medium
**Location**: `src/server/handlers.ts:128-146`
**Type**: Dead Code

## 问题

函数 `getStorageForRequest` 定义后从未被调用，与 `resolveStorage` 功能重复。

## 修复

已删除。

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
