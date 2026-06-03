# Remote Storage 客户端配置存储后端

## 背景

用户希望在客户端通过 `remoteStorage()` 配置使用 jsonl 还是 mongodb，以及各自的参数。

## 设计

### 客户端 API

```typescript
// 使用 MongoDB
const adapter = remoteStorage({
  backend: 'mongodb',
  mongoUrl: 'mongodb://user:pass@host:27017',
  database: 'myapp'
})

// 使用 JSONL
const adapter = remoteStorage({
  backend: 'jsonl',
  jsonlDir: '/tmp/my-app-data'
})

// 默认 (不指定 backend，走 BFF 默认配置)
const adapter = remoteStorage()
```

### 请求流程

1. 客户端发起请求，带 `backend` 类型和配置
2. BFF 根据 `backend` 路由到 mongodb 或 jsonl adapter
3. 每次请求都传配置参数

### BFF 行为

BFF 根据客户端请求中的 `backend` 类型，动态调用对应 adapter。BFF 不预建连接。

## 实现

### 1. `src/storage/adapters/remoteStorage.ts`

更新 `RemoteStorageOptions` 类型：

```typescript
export interface RemoteStorageOptions {
  baseUrl?: string;
  entityId?: string;
  // 新增: 存储后端配置
  backend?: 'mongodb' | 'jsonl';
  mongoUrl?: string;
  mongoDb?: string;
  jsonlDir?: string;
}
```

更新 `remoteStorage()` 函数，将 backend 配置放入请求中。

### 2. `src/storage/protocol.ts`

更新 `RestStorageProtocol`，在请求中附带 backend 配置：

```typescript
buildGetUrl(key: string): string {
  const url = `${this.baseUrl}/storage/get/${encodeURIComponent(key)}`;
  // 附带 backend 配置
  const params = new URLSearchParams();
  if (this.entityId) params.set('entityId', this.entityId);
  if (this.backend) params.set('backend', this.backend);
  if (this.backend === 'mongodb' && this.mongoUrl) {
    params.set('mongoUrl', this.mongoUrl);
    params.set('mongoDb', this.mongoDb || 'jotai_state_store');
  }
  if (this.backend === 'jsonl' && this.jsonlDir) {
    params.set('jsonlDir', this.jsonlDir);
  }
  // ...
}
```

### 3. `src/server/handlers.ts`

更新 handlers，从请求中解析 backend 配置，动态创建对应 adapter：

```typescript
async handleSet(req, res) {
  const { key } = req.params;
  const { value, backend, mongoUrl, mongoDb, jsonlDir } = await parseBody(req);

  let storage;
  if (backend === 'mongodb') {
    const adapter = await mongodbStorage({ url: mongoUrl, database: mongoDb });
    storage = adapter.storage;
  } else if (backend === 'jsonl') {
    const adapter = jsonlStorage({ dir: jsonlDir });
    storage = adapter.storage;
  } else {
    // 使用默认 storage
    storage = getDefaultStorage();
  }

  await storage.set(key, value);
  // ...
}
```

### 4. `src/server/router.ts`

更新 router 传递 backend 相关参数。

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/storage/adapters/remoteStorage.ts` | 添加 backend 配置字段 |
| `src/storage/protocol.ts` | 附带 backend 配置到请求 URL |
| `src/server/handlers.ts` | 解析 backend 并动态路由 |
| `src/server/router.ts` | 传递 backend 参数 |

## 验证

1. 构建后检查主 bundle 不含 mongodb/jsonl 代码
2. 测试 `remoteStorage({ backend: 'mongodb', ... })` 能正常工作
3. 测试 `remoteStorage({ backend: 'jsonl', ... })` 能正常工作
4. 测试默认 `remoteStorage()` 仍能正常工作
