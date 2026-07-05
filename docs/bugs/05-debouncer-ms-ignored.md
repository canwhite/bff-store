# BUG-05: debouncer ms 参数后续调用无效

**Severity**: Low
**Location**: `src/debouncer.ts:48-55`
**Type**: Logic Error

## 问题

`DebouncerMap.getDebouncer()` 在 key 已存在时忽略传入的 `ms` 参数：

```typescript
getDebouncer(key: string, ms?: number): Debouncer {
  let debouncer = this.debouncers.get(key);
  if (!debouncer) {
    debouncer = createDebouncer(ms ?? this.defaultMs);
    this.debouncers.set(key, debouncer);
  }
  return debouncer;  // 后续传入不同 ms 被忽略
}
```

## 修复

ms 不同时替换已有 debouncer 实例：

```typescript
getDebouncer(key: string, ms?: number): Debouncer {
  const effectiveMs = ms ?? this.defaultMs;
  let debouncer = this.debouncers.get(key);
  if (!debouncer || debouncer.ms !== effectiveMs) {
    debouncer = createDebouncer(effectiveMs);
    this.debouncers.set(key, debouncer);
  }
  return debouncer;
}
```

## 验证

- Build: ✅
- Tests: ✅ (10 debouncer tests passed)
