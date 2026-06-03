# Embedded Sidecar API Server (BFF)

## Overview

Provides a lightweight HTTP server that acts as a BFF (Backend for Frontend) proxy for storage backends (JSONL/MongoDB). Designed for use in browser/Next.js environments where direct file system or database access isn't available.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Application                      │
│                   (Next.js/Node.js)                     │
│                                                          │
│  useStore() ───► remoteStorageAdapter ──► localhost:3847 │
│                      (HTTP)              │               │
└──────────────────────────────────────────┼───────────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │   Embedded API Server  │
                              │       (BFF Layer)      │
                              │                        │
                              │  /storage/get/:key     │
                              │  /storage/set/:key     │
                              │  /storage/delete/:key  │
                              │  /storage/batch-get    │
                              │  /storage/batch-set    │
                              └────────────────────────┘
```

## Auto-Start Behavior

The server starts **automatically** when using `remoteStorage()`:

```typescript
import { createStore, useStore, remoteStorage } from 'bff-store';

// Server auto-starts on first createStore call
const store = createStore('user-1', config, {
  storage: remoteStorage()
});
```

**Singleton pattern**: Only one server instance runs. Subsequent `createStore` calls reuse the existing server.

## API Endpoints

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/storage/get/:key?entityId=x` | - | `{ value: T }` |
| POST | `/storage/set/:key?entityId=x` | `{ value: T }` | `{ success: true }` |
| DELETE | `/storage/delete/:key?entityId=x` | - | `{ success: true }` |
| POST | `/storage/batch-get?entityId=x` | `{ keys: string[] }` | `{ entries: {...} }` |
| POST | `/storage/batch-set?entityId=x` | `{ entries: {...} }` | `{ success: true }` |
| GET | `/health` | - | `{ status: 'ok' }` |

## Server Options

```typescript
interface ServerOptions {
  port?: number;        // Default: 3847
  host?: string;       // Default: localhost
  backend: 'jsonl' | 'mongodb';
  jsonlDir?: string;   // For JSONL backend (default: ./data)
  mongoUrl?: string;   // For MongoDB backend (required)
  mongoDb?: string;    // For MongoDB backend (default: jotai_state_store)
}
```

## Programmatic Usage

### Auto-Start (Recommended)

```typescript
import { createStore, remoteStorage } from 'bff-store';

// Server auto-starts with defaults (JSONL, port 3847, ./data dir)
const store = createStore('user-1', config, {
  storage: remoteStorage()
});
```

### Customize Server Before First Use

```typescript
import { startServer, createStore, remoteStorage } from 'bff-store';

// Start with custom settings
await startServer({
  backend: 'mongodb',
  mongoUrl: 'mongodb://localhost:27017',
  port: 5000,
});

// Now all remoteStorage() calls use this server
const store = createStore('user-1', config, {
  storage: remoteStorage()
});
```

### Using startServer Directly

```typescript
import { startServer } from 'bff-store';

const server = await startServer({
  backend: 'jsonl',
  port: 3847,
  jsonlDir: './data',
});

// Server runs until Ctrl+C
```

## Remote Storage Adapter

```typescript
import { remoteStorage } from 'bff-store';

// Default: http://localhost:3847
const adapter = remoteStorage();

// Custom server URL
const adapter = remoteStorage({ baseUrl: 'http://custom:9999' });

// With default entityId
const adapter = remoteStorage({ entityId: 'user-123' });
```

## Graceful Shutdown

The server handles `SIGINT` and `SIGTERM` signals:
- Stops accepting new connections
- Closes existing connections
- Exits cleanly after 5 seconds max

## File Structure

```
src/server/
├── index.ts          # Main entry, singleton manager, startServer()
├── router.ts         # HTTP pattern-based router
├── handlers.ts        # Storage operation handlers
└── entityIdCache.ts  # Multi-tenant storage cache
```

### Router (`router.ts`)

Pattern-based HTTP router with named parameter extraction.

```typescript
router.get('/storage/get/:key', handler);  // :key is a named param
router.post('/storage/set/:key', handler);
router.delete('/storage/delete/:key', handler);
router.post('/storage/batch-get', handler);
router.post('/storage/batch-set', handler);
```

### EntityIdCache (`entityIdCache.ts`)

Caches JSONL storage adapters per `entityId` to avoid recreation:

```typescript
const cache = new EntityIdCache({ dir: './data' });
const storage = cache.getStorage('user-123');  // Gets or creates
```

### Handlers (`handlers.ts`)

Request handlers for storage operations. Each handler reads `entityId` from URL query params:

```typescript
const handlers = createStorageHandlers({
  getStorage: (entityId?: string) => entityIdCache.getStorage(entityId),
});
```

## Testing

```bash
npm test -- tests/server.test.ts
```

Server tests create a temporary directory for JSONL storage, start the server on port 3849, and verify all endpoints work correctly.
