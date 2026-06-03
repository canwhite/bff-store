# bff-store

A jotai-based state management library with pluggable storage adapters and built-in BFF (Backend for Frontend) for browser/Next.js environments.

## Features

- **Configuration-driven**: Define multiple states via array configuration
- **Pluggable storage**: Use memory, JSONL files, MongoDB, or remote server
- **Auto-generated hooks**: React hooks auto-generated from config
- **Loading states**: Built-in loading state tracking
- **Debounced saves**: Automatic debouncing for non-critical data
- **Built-in BFF**: Embedded sidecar API server for browser/Next.js environments

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                       │
│                   (Next.js/Browser)                      │
│                                                          │
│  useStore() ──► remoteStorage ──► localhost:3847        │
│                         │                                │
│                         ▼                                │
│              ┌─────────────────────┐                     │
│              │   BFF (Sidecar)     │                     │
│              │  bff-store │                     │
│              │                     │                     │
│              │  /storage/get/:key  │                     │
│              │  /storage/set/:key  │                     │
│              │  /storage/delete   │                     │
│              └──────────┬──────────┘                     │
│                         │                                │
│                         ▼                                │
│              ┌─────────────────────┐                     │
│              │   JSONL / MongoDB   │                     │
│              └─────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install bff-store
# or
pnpm add bff-store
```

## Client Usage (Browser / Next.js)

BFF Server 会自动启动，客户端只需使用 `remoteStorage()` 并指定存储后端：

```typescript
import { createStore, useStore, remoteStorage } from 'bff-store';

const config = [
  { key: 'theme', defaultValue: 'dark' },
  { key: 'characters', defaultValue: [] },
] as const;

// 使用 MongoDB 存储
const store = createStore('my-app', config, {
  storage: remoteStorage({
    backend: 'mongodb',
    mongoUrl: 'mongodb://user:pass@host:27017',
    mongoDb: 'myapp',
  }),
});

// 或使用 JSONL 存储
// const store = createStore('my-app', config, {
//   storage: remoteStorage({
//     backend: 'jsonl',
//     jsonlDir: '/tmp/my-app-data',
//   }),
// });
```

### 在 React 组件中使用

```typescript
function App() {
  const { theme, setTheme, isLoading } = useStore(store);

  if (isLoading) return <div>Loading...</div>;

  return <input value={theme} onChange={e => setTheme(e.target.value)} />;
}
```

### 自定义 BFF 服务器地址

```typescript
// 如果 BFF 运行在其他地址
const adapter = remoteStorage({ baseUrl: 'http://localhost:3847' });
const adapter = remoteStorage({ entityId: 'user-123' });  // 多租户支持
```

### Memory Storage (不持久化)

适用于开发环境或不需要持久化的场景：

```typescript
import { createStore, useStore, memoryStorage } from 'bff-store';

const store = createStore('my-app', config, {
  storage: memoryStorage(),  // 不走 BFF，数据仅存在内存
});
```

## Advanced: 手动启动 BFF Server

大多数情况不需要手动启动 BFF，它会自动启动。如需手动控制：

```typescript
import { startServer } from 'bff-store/server';

await startServer({
  port: 3847,
});
```

## Node.js 直接使用 Storage Adapters

如果不通过 BFF，可以直接在 Node.js 中使用存储适配器：

```typescript
import { createStore } from 'bff-store';
import { jsonlStorage } from 'bff-store/jsonl';
import { mongodbStorage } from 'bff-store/mongodb';

// 使用 JSONL
const adapter = jsonlStorage({ dir: './sessions' });

// 使用 MongoDB
const adapter = await mongodbStorage({
  url: 'mongodb://localhost:27017',
  database: 'myapp',
});

const store = createStore('entity-123', config, { storage: adapter });
```

## API Endpoints (BFF Server)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/storage/get/:key?entityId=x` | - | Get value by key |
| POST | `/storage/set/:key?entityId=x` | `{ value }` | Set value |
| DELETE | `/storage/delete/:key?entityId=x` | - | Delete key |
| POST | `/storage/batch-get?entityId=x` | `{ keys: [] }` | Batch get |
| POST | `/storage/batch-set?entityId=x` | `{ entries: {} }` | Batch set |
| GET | `/health` | - | Health check |

## API Reference

### `createStore(entityId, config, options)`

Creates a store with multiple persisted atoms.

- `entityId`: Unique identifier for this store instance
- `config`: Array of atom configurations
- `options.storage`: Storage adapter (required)
- `options.debounceMs`: Debounce delay in ms (default: 800)

### `useStore(store)`

React hook to use the store in components.

Returns: `{ ...data, ...setters, isLoading }`

Setter names are derived by capitalizing the config key:
- `theme` → `setTheme`
- `userName` → `setUserName`

### `remoteStorage(options?)`

Creates a remote storage adapter for connecting to the BFF server.

```typescript
// 基本用法 - BFF 使用默认存储后端
const adapter = remoteStorage();

// 指定使用 MongoDB
const adapter = remoteStorage({
  backend: 'mongodb',
  mongoUrl: 'mongodb://user:pass@host:27017',
  mongoDb: 'myapp',
});

// 指定使用 JSONL
const adapter = remoteStorage({
  backend: 'jsonl',
  jsonlDir: '/tmp/my-app-data',
});
```

- `options.baseUrl`: BFF server URL (default: `http://localhost:3847`)
- `options.entityId`: Default entityId for all requests
- `options.backend`: Storage backend type `'mongodb'` or `'jsonl'`
- `options.mongoUrl`: MongoDB connection URL (required if backend is mongodb)
- `options.mongoDb`: MongoDB database name (default: `jotai_state_store`)
- `options.jsonlDir`: JSONL storage directory (required if backend is jsonl)

### `startServer(options)`

Starts the BFF server (singleton pattern). Import from `bff-store/server`.

- `options.port`: Server port (default: 3847)

Note: Storage backend is configured by the client via `remoteStorage()` options, not by the server.

## Package Exports

| Export | Description | Environment |
|--------|-------------|-------------|
| `bff-store` | Main entry: createStore, useStore, memoryStorage, remoteStorage | Browser + Node.js |
| `bff-store/jsonl` | JSONL storage adapter | Node.js only |
| `bff-store/mongodb` | MongoDB storage adapter | Node.js only |
| `bff-store/server` | BFF server (startServer, Router, etc.) | Node.js only |

## License

MIT
