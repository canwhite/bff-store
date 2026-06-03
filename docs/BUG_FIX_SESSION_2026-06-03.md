# Bug Fix Session — 2026-06-03

本次会话诊断并修复了 4 个 bug，覆盖类型解析、协议层、存储适配器三个层面。

---

## Bug 1 (P0): `'backend' does not exist in type 'RemoteStorageOptions'`

### 现象

`tests/next_test` 中 `"bff-store": "file:../../dist"` 安装时，TypeScript 报错：

```
Object literal may only specify known properties, and 'backend' does not exist in type 'RemoteStorageOptions'.ts(2353)
```

### 根因

**因素一（主因）：dist/package.json 路径错误。** 根目录 `package.json` 的路径字段带有 `./dist/` 前缀：

```json
"main": "dist/index.js",
"exports": { ".": { "types": "./dist/index.d.ts", ... } }
```

当通过 `"file:../../dist"` 本地安装时，包根目录就是 `dist/` 本身，`./dist/index.d.ts` 解析为 `dist/dist/index.d.ts` —— 文件不存在。

| 场景 | 包根目录 | `./dist/index.d.ts` 解析 | 存在? |
|------|----------|-------------------------|------|
| npm 发布 | 项目根 | `项目根/dist/index.d.ts` | 是 |
| `file:../../dist` | `dist/` | `dist/dist/index.d.ts` | 否 |

**因素二（助推）：全局安装了旧版本。** 本地 symlink 解析失败后，TypeScript 沿目录树向上查找，在 `/Users/Admin/node_modules/bff-store/` 找到旧版 v0.1.1，该版本 `RemoteStorageOptions` 无 `backend` 字段。

### 修复

1. **新增** `scripts/adapt-dist-package.js` — 构建后将 `dist/package.json` 路径改写为相对 dist/：
   - `dist/index.js` → `index.js`
   - `./dist/index.d.ts` → `./index.d.ts`
   - `./dist/storage/...` → `./storage/...`

2. **修改** `package.json` build 脚本：
   ```
   "build": "tsup && cp package.json dist/package.json && node scripts/adapt-dist-package.js && for f in dist/*.d.mts; do cp \"$f\" \"${f%.d.mts}.d.ts\"; done"
   ```

### 涉及文件

| 文件 | 操作 |
|------|------|
| `scripts/adapt-dist-package.js` | 新增 |
| `package.json` | 修改 build 脚本 |

---

## Bug 2 (P0): GET/DELETE 请求拿不到 `mongoUrl`

### 现象

BFF 模式下，POST (`/storage/set`) 正常，但 GET (`/storage/get`) 返回：

```
{"error":"Error: mongoUrl is required for mongodb backend"}
```

### 根因

`src/storage/protocol.ts` 的 `buildUrl` / `buildBatchGetUrl` / `buildBatchSetUrl` 方法只将 `backend` 和 `entityId` 拼入 URL query params，`mongoUrl`、`mongoDb`、`jsonlDir` 仅通过 POST body 传递（`createStorageWithProtocol` 中将 `backendConfig` spread 到 body）。

GET/DELETE 无 body → server 端 `resolveStorage` 从 URL query params 解析不到 `mongoUrl` → 尝试 `mongodbStorage({ url: undefined })` → 抛错。

### 修复

抽取 `appendBackendParams()` 方法，将全部 backend 参数拼入 URL query params：

```typescript
private appendBackendParams(params: URLSearchParams): void {
  if (this.backendConfig.backend)   params.set('backend', this.backendConfig.backend);
  if (this.backendConfig.mongoUrl)  params.set('mongoUrl', this.backendConfig.mongoUrl);
  if (this.backendConfig.mongoDb)   params.set('mongoDb', this.backendConfig.mongoDb);
  if (this.backendConfig.jsonlDir)  params.set('jsonlDir', this.backendConfig.jsonlDir);
}
```

### 涉及文件

| 文件 | 操作 |
|------|------|
| `src/storage/protocol.ts` | 新增 `appendBackendParams()`，`buildUrl` / `buildBatchGetUrl` / `buildBatchSetUrl` 调用之 |

---

## Bug 3 (P2): JSONL adapter 静默失败（entityId 默认 null）

### 现象

BFF server 使用 JSONL backend 时，SET 返回 `{"success":true}` 但数据未写入磁盘，GET 返回 `{"value":null}`。

### 根因

`src/storage/jsonl.ts` 中 `entityId` 初始值为 `null`，GET 和 SET 操作均有 `if (!entityId) return` 守卫，导致静默跳过。对比 MongoDB adapter 默认 `currentEntityId = 'default'`，行为不一致。

### 修复

```typescript
// Before
let entityId: string | null = null;

// After
let entityId: string = 'default';
```

### 涉及文件

| 文件 | 操作 |
|------|------|
| `src/storage/jsonl.ts` | `entityId` 默认值 `null` → `'default'` |

---

## Bug 4 (P2): MongoDB 副本集连接失败

### 现象

BFF server 连接 MongoDB 时报：

```
MongoServerSelectionError: connection <monitor> to 172.16.42.101:27017 closed
TopologyDescription { type: 'ReplicaSetNoPrimary', setName: 'rs0' }
```

### 根因

`localhost:27017` 属于副本集 `rs0`，成员地址 `172.16.42.101:27017`。MongoDB driver 自动发现副本集后切换到该地址，但该地址网络不通。

### 修复

在 MongoDB URL 中拼接 `?directConnection=true&authSource=admin` 绕过副本集发现。

```typescript
const mongoUrl = `mongodb://${user}:${pwd}@${host}/${db}?directConnection=true&authSource=admin`;
```

### 涉及文件

| 文件 | 操作 |
|------|------|
| `tests/next_test/src/app/page.tsx` | 添加 URL 参数 |

---

## 测试覆盖

| 文件 | 内容 |
|------|------|
| `tests/next_test/test-types.ts` | 原始 bug 用例 — `backend: 'jsonl'` |
| `tests/next_test/test-similar-root.tsx` | 同上 .tsx 版本 |
| `tests/next_test/test-regression-remote-storage.ts` | 全参数组合：jsonl / mongodb / 可选字段 / 默认构造 |
| `tests/next_test/src/app/test-similar.tsx` | .tsx 中 remoteStorage 类型测试 |
| `tests/next_test/src/app/test-regression-store.tsx` | createStore + remoteStorage 组合测试 |
| `tests/next_test/src/app/test-mongodb.tsx` | MongoDB 前端组件测试 |
| `tests/next_test/test-mongodb-direct.ts` | mongodbStorage 直接调用测试脚本 |
| `tests/next_test/test-mongodb-remote.ts` | remoteStorage → MongoDB 路由测试脚本 |
| `tests/next_test/src/app/page.tsx` | 浏览器端到端测试（可切换 jsonl/mongodb） |

## 验证结果

- `npm run build`（项目根）：构建成功
- `npx tsc --noEmit`（tests/next_test）：0 errors
- `curl` 测试 JSONL SET/GET/DELETE 全链路：通过
- `curl` 测试 MongoDB SET/GET/DELETE 全链路：通过
