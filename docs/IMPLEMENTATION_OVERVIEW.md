# 实现大纲 / Implementation Overview

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  Frontend / React                                       │
│  createStore() → useStore() → atoms (jotai)            │
└────────────────────────┬────────────────────────────────┘
                         │ storage API (HTTP or direct)
┌────────────────────────▼────────────────────────────────┐
│  BFF Server (Node.js sidecar)                           │
│  Router → Handlers → Storage Cache                     │
└────────────────────────┬────────────────────────────────┘
                         │ storage adapter
┌────────────────────────▼────────────────────────────────┐
│  Storage Backend                                        │
│  jsonl / mongodb / memory                               │
└─────────────────────────────────────────────────────────┘
```

三层分离：
- **前端层**：React 组件通过 `useStore` 消费 jotai atom
- **BFF 层**：Node.js sidecar server，代理存储请求，支持多租户
- **存储层**：可插拔后端（JSONL 文件、MongoDB、内存）

---

## 模块映射表

| 模块 | 文件 | 职责 |
|------|------|------|
| `createStore` | `src/createStore.ts` | 创建多 atom 持久化 store |
| `createPersistedAtom` | `src/atomCreator.ts` | 单个 atom + loading 状态 |
| `useStore` | `src/useStore.ts` | React hook，消费 store |
| `debouncer` | `src/debouncer.ts` | 写冲突防抖（800ms default） |
| `remoteStorage` | `src/storage/adapters/remoteStorage.ts` | 客户端 HTTP 适配器 |
| `HttpTransport` | `src/storage/transport.ts` | HTTP GET/POST/DELETE 原语 |
| `RestStorageProtocol` | `src/storage/protocol.ts` | REST 风格协议封装 |
| `startServer` | `src/server/index.ts` | BFF 服务端单例启动 |
| `createStorageHandlers` | `src/server/handlers.ts` | 请求 → storage 分发 + 缓存 |
| `Router` | `src/server/router.ts` | 路径 → handler 匹配（:key 参数） |
| `EntityIdCache` | `src/server/entityIdCache.ts` | JSONL 多租户隔离 |
| `jsonlStorage` | `src/storage/jsonl.ts` | 文件落盘 `{dir}/{entityId}/{key}.jsonl` |
| `mongodbStorage` | `src/storage/mongodb.ts` | MongoDB 落盘 `{database}.state_{entityId}` |
| `memoryStorage` | `src/storage/memory.ts` | 内存存储（测试/开发） |
| `createNodeStore` | `src/nodeStore.ts` | Node.js 环境专用（非 React） |

---

## 数据流详解

### 1. 初始化流程

```typescript
// 前端
const store = createStore('entity-A', config, { storage: adapter });

// 内部执行
adapter.setEntityId('entity-A')           // 设置租户 ID
for (atomConfig of config) {
  createPersistedAtom(atomConfig, entityId, storage, { debounceMs })
  // → 创建 baseAtom（初始值 defaultValue）
  // → 创建 loadingAtom（初始值 true）
  // → baseAtom.onMount = setValue => storage.get(key).then(setValue)
}
```

### 2. 读取流程（React 组件）

```
useStore(store)
→ buildStoreResult(store)
  → useAtom(atom) for each config[key]
  → baseAtom.get() // 同步返回 jotai store 中的当前值
```

**注意**：`storage.get()` 只在 `onMount` 时调用一次，结果写入 baseAtom。后续读取直接走 jotai store 内部状态，不涉及 storage。

### 3. 写入流程（带防抖）

```
setTheme('dark')
→ writeAtom.write(dark)
  → baseAtom.set(dark)           // 本地立即更新，UI 同步响应
  → debouncer.debounce(key, saveFn, 800ms)
    → storage.set(key, dark)     // 延迟写入后端
```

- `immediate: true` 的 atom 跳过防抖，直接 `storage.set()`
- 防抖 key 格式：`${entityId}:${config.key}`，避免跨 store 干扰

### 4. 远程写入（remoteStorage 路径）

```
setTheme('dark')
→ writeAtom.write(dark)
  → baseAtom.set(dark)
  → debouncer.debounce(...)
    → storage.set(key, value)
      → HttpTransport.post('/storage/set/:key', { value })
        → BFF server: POST /storage/set/:key
          → handlers.handleSet()
          → getCachedStorage(config, entityId)
          → storage.set(key, value)
```

### 5. Node.js 服务端（BFF）

```
http.createServer()
→ Router.handle(req, res)
  → matched route: /storage/get/:key
    → handlers.handleGet(req, res, { key })
      → resolveStorage(req)        // 解析 body + url config
      → storage.get(key)
      → res.json({ value })
```

---

## 多租户隔离策略

### Server 端

- **JSONL**：每个 `entityId` 对应独立目录 `{jsonlDir}/{entityId}/`
- **MongoDB**：每个 `entityId` 对应独立 collection `state_{entityId}`
- **Storage Cache**：`Map<cacheKey, { adapter, lastUsed }>`，TTL 5min，Lru 驱逐（max 10）

### Client 端

- `remoteStorage.setEntityId(id)` 更新 `entityId.current`
- 后续所有请求在 protocol 层拼入 query param `?entityId=xxx`

---

## 关键设计决策

### 为什么 atom 初始值用 defaultValue 而非从 storage 加载？

jotai 要求 atom 必须有同步初始值。`createPersistedAtom` 创建时传入 `defaultValue`，然后通过 `onMount` 异步从 storage 覆盖。

```typescript
const baseAtom = atom(config.defaultValue);  // 同步默认值
baseAtom.onMount = (setValue) => {
  storage.get(key).then((value) => {
    if (value !== null) setValue(value);  // 异步覆盖
  });
};
```

### 为什么需要 loadingAtom？

`onMount` 是异步的，React 组件可能在数据加载完成前就开始 render。`loadingAtom` 跟踪所有 atom 的加载状态，合并为 `useStore` 返回的 `isLoading` 布尔值。

### 防抖 DebouncerMap 为什么用 module-level 单例？

所有 atom 共享同一个 `DebouncerMap` 实例，确保同一 `entityId:key` 的多次写入只触发一次延迟保存。

---

## 路由表（服务端）

| Method | Path | Handler |
|--------|------|---------|
| GET | `/storage/get/:key` | `handleGet` |
| POST | `/storage/set/:key` | `handleSet` |
| DELETE | `/storage/delete/:key` | `handleDelete` |
| POST | `/storage/batch-get` | `handleBatchGet` |
| POST | `/storage/batch-set` | `handleBatchSet` |
| GET | `/health` | `handleHealth` |

---

## 配置文件

| 文件 | 用途 |
|------|------|
| `tsup.config.ts` | 多入口打包（index, jsonl-entry, mongodb-entry, server/entry, cli） |
| `tsconfig.json` | TypeScript 配置 |
| `vitest.config.ts` | 测试配置 |
| `package.json` | 导出字段：`import` → `dist/index.mjs` |
