# BUG-14: `isServerRunning()` 未使用

**Severity**: Low
**Location**: `src/server/index.ts:41-43`
**Type**: Dead Code

## 问题

函数 `isServerRunning()` 定义后从未被调用。

## 修复

已删除。

## 验证

- Build: ✅
- Tests: ✅ (69 passed)
