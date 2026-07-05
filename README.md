# bff-store

A jotai-based state management library with pluggable storage adapters and a built-in BFF (Backend for Frontend) for browser/Next.js environments.

## Features

- **Configuration-driven**: Define multiple states via array configuration
- **Pluggable storage**: Use memory, JSONL files, MongoDB, or a remote server
- **Auto-generated hooks**: React hooks auto-generated from config
- **Loading states**: Built-in loading state tracking
- **Debounced saves**: Automatic debouncing for non-critical data (800ms default)
- **Built-in BFF**: Embedded sidecar API server for browser/Next.js environments
- **Multi-tenant**: Per-entityId isolation via `setEntityId()`
- **Unmount cleanup**: Pending writes cancelled on component unmount
- **Embedded Sidecar**: Like a serverless function that auto-starts on first use — no manual server deployment required

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
│                   (Next.js / Browser)                   │
│                                                         │
│  useStore() ──► remoteStorage ──► localhost:3847      │
│                         │                               │
│                         ▼                               │
│              ┌─────────────────────┐                  │
│              │     BFF (Sidecar)    │                  │
│              │                     │                  │
│              │  /storage/get/:key  │                  │
│              │  /storage/set/:key  │                  │
│              │  /storage/batch-*   │                  │
│              └──────────┬──────────┘                  │
│                         │                               │
│                         ▼                               │
│              ┌─────────────────────┐                  │
│              │   JSONL / MongoDB   │                  │
│              │    (multi-tenant)    │                  │
│              └─────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Init**: `createStore()` creates atoms, `remoteStorage` auto-starts the BFF server
2. **Read**: `useStore()` returns from jotai store directly — no I/O
3. **Write**: Update local jotai atom first (sync UI response), then debounce-persist to storage
4. **Unmount**: Automatically cancel pending writes to prevent writes from destroyed components

## Embedded Sidecar Pattern

bff-store borrows the **embedded sidecar** pattern from microservices: the BFF server is co-located with your application process, auto-started on first use, with the lifecycle managed transparently.

| Aspect | Classic Microservice Sidecar | bff-store Embedded Sidecar |
|--------|----------------------------|--------------------------|
| Deployment | Separate container, same pod | In-process, same Node.js process |
| Startup | Kubernetes orchestrates | `createStore()` triggers `import('./server')` |
| Singleton | One per pod | One per process (singleton `startServer`) |
| State | External DB / volume | JSONL / MongoDB |
| Scaling | Horizontal pod scaling | Multiple store instances share one server |
| Cold start | Pod scheduling overhead | Module import + server listen (~100ms) |

This gives you the **transparency of serverless** (no manual server deployment) with the **control of a long-running process** (full backend, no 100ms timeout, no cold starts after first invocation).

### How it compares to serverless

| | Serverless (Lambda) | bff-store Sidecar |
|--|---------------------|-------------------|
| Cold start | 100ms–1s (platform) | ~100ms (import + listen) |
| State | External KV store (S3/Dynamo) | JSONL / MongoDB (local) |
| Concurrency | One invocation per instance | All stores share one server |
| Tenant isolation | Separate functions | Separate collections / directories |
| Failure mode | Invocation fails | Server restarts, pending writes lost (mitigated by unmount cancel) |

## Installation

```bash
npm install bff-store
# or
pnpm add bff-store
```

## Client Usage (Browser / Next.js)

The BFF server starts automatically. Use `remoteStorage()` to specify the storage backend:

```typescript
import { createStore, useStore, remoteStorage } from 'bff-store';

const config = [
  { key: 'theme', defaultValue: 'dark' },
  { key: 'characters', defaultValue: [] },
  { key: 'settings', defaultValue: {}, immediate: true },  // persist immediately, no debounce
] as const;

// Using MongoDB
const store = createStore('my-app', config, {
  storage: remoteStorage({
    backend: 'mongodb',
    mongoUrl: 'mongodb://user:pass@host:27017',
    mongoDb: 'myapp',
  }),
});

// Or using JSONL
// const store = createStore('my-app', config, {
//   storage: remoteStorage({
//     backend: 'jsonl',
//     jsonlDir: '/tmp/my-app-data',
//   }),
// });
```

### In a React Component

```typescript
function App() {
  const { theme, setTheme, characters, setCharacters, isLoading } = useStore(store);

  if (isLoading) return <div>Loading...</div>;

  return (
    <input value={theme} onChange={e => setTheme(e.target.value)} />
  );
}
```

### Immediate Persistence (no debounce)

For critical data, use `immediate: true`:

```typescript
const config = [
  { key: 'autosave', defaultValue: '', immediate: true },
] as const;
```

### Waiting for the Server

`createStore` is synchronous, but server startup is asynchronous. Optionally wait:

```typescript
import { createStore, waitForServer } from 'bff-store';

const store = createStore('my-app', config, { storage: adapter });
await waitForServer();
```

### Multi-Tenant Switching

Switch tenants dynamically via `setEntityId`:

```typescript
const adapter = remoteStorage({ entityId: 'tenant-A' });
const store = createStore('tenant-A', config, { storage: adapter });

// Switch tenant
adapter.setEntityId('tenant-B');
```

### Memory Storage (non-persistent)

For development or non-persistent use cases:

```typescript
import { createStore, useStore, memoryStorage } from 'bff-store';

const store = createStore('my-app', config, {
  storage: memoryStorage(),  // data lives only in memory
});
```

## Node.js Direct Storage Adapter Usage

You can also use storage adapters directly in Node.js without the BFF:

```typescript
import { createNodeStore, getDefaultStore } from 'bff-store';
import { jsonlStorage } from 'bff-store/jsonl';
import { mongodbStorage } from 'bff-store/mongodb';

// Using JSONL
const store = createNodeStore('entity-123', [
  { key: 'theme', defaultValue: 'dark' },
  { key: 'count', defaultValue: 0 },
], {
  storage: jsonlStorage({ dir: './sessions' }),
});

// Wait for initial load (5s timeout)
await store.waitForLoad();

// Read/write via jotai getDefaultStore()
const jotai = getDefaultStore();
jotai.set(store.atoms.theme, 'light');   // auto-debounce persists
console.log(jotai.get(store.atoms.count));

// Or using MongoDB
const store2 = createNodeStore('entity-456', [
  { key: 'data', defaultValue: null },
], {
  storage: await mongodbStorage({
    url: 'mongodb://localhost:27017',
    database: 'myapp',
  }),
});
```

### Environment Detection

```typescript
import { isNode, isBrowser } from 'bff-store';

if (isNode()) { /* Node.js */ }
if (isBrowser()) { /* Browser */ }
```

## Storage Backends

### JSONL

File format: `{dir}/{entityId}/{encodeURIComponent(key)}.jsonl`

Each line is a JSON object with timestamp. `get` reads the last line for the latest value.

### MongoDB

Collection name: `state_{entityId}`. Each key uses upsert — only the latest value is kept.

> For production, create a compound index on `key + entityId`:
> ```javascript
> db.state_<entityId>.createIndex({ key: 1, entityId: 1 }, { unique: true })
> ```

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

### `waitForServer()`

Returns a promise that resolves when the auto-started BFF server is ready. Only meaningful in Node.js with `remoteStorage`.

```typescript
import { waitForServer } from 'bff-store';
await waitForServer();
```

### `useStore(store)`

React hook to consume the store in components.

Returns: `{ ...data, ...setters, isLoading }`

Setter names are derived by capitalizing the config key:
- `theme` → `setTheme`
- `userName` → `setUserName`

### `createNodeStore(entityId, config, options)`

Node.js environment store with `waitForLoad()`.

```typescript
const store = createNodeStore('entity-123', config, { storage: adapter });
await store.waitForLoad();  // 5s timeout
```

### `remoteStorage(options?)`

Creates a remote storage adapter for connecting to the BFF server.

```typescript
// Basic
const adapter = remoteStorage();

// Use MongoDB
const adapter = remoteStorage({
  backend: 'mongodb',
  mongoUrl: 'mongodb://user:pass@host:27017',
  mongoDb: 'myapp',
});

// Use JSONL
const adapter = remoteStorage({
  backend: 'jsonl',
  jsonlDir: '/tmp/my-app-data',
});

// Multi-tenant
const adapter = remoteStorage({ entityId: 'user-123' });
adapter.setEntityId('user-456');  // switch tenant
```

- `options.baseUrl`: BFF server URL (default: `http://localhost:3847`)
- `options.entityId`: Default entityId for all requests
- `options.backend`: Storage backend type `'mongodb'` or `'jsonl'`
- `options.mongoUrl`: MongoDB connection URL (required if backend is mongodb)
- `options.mongoDb`: MongoDB database name (default: `jotai_state_store`)
- `options.jsonlDir`: JSONL storage directory (default: `./data`)

### `startServer(options)`

Starts the BFF server (singleton pattern). Import from `bff-store/server`.

```typescript
import { startServer } from 'bff-store/server';

await startServer({
  port: 3847,
  backend: 'jsonl',
  jsonlDir: './data',
});
```

## Package Exports

| Export | Description | Environment |
|--------|-------------|-------------|
| `bff-store` | Main: createStore, useStore, createNodeStore, waitForServer, isNode, isBrowser, memoryStorage, remoteStorage | Browser + Node.js |
| `bff-store/jsonl` | JSONL storage adapter | Node.js only |
| `bff-store/mongodb` | MongoDB storage adapter (async factory) | Node.js only |
| `bff-store/server` | BFF server: startServer, Router, EntityIdCache | Node.js only |

## Changelog

### v0.1.1 (2026-07-05)

- `createStore` with `remote` storage now waits for server startup to complete
- `waitForServer()` added for explicit server readiness
- `remoteStorage.setEntityId()` now works correctly (live entityId reference)
- MongoDB `set` uses upsert mode — no more unbounded document accumulation
- JSONL key encoding changed to `encodeURIComponent` — prevents `a.b` / `a-b` collision
- `atom.onMount` unmount cleanup cancels pending debounced writes
- `waitForLoad()` now has a 5s timeout
- HTTP error responses now include server-returned error details

## License

MIT
