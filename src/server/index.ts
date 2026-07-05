/**
 * Embedded Sidecar API Server
 *
 * Lightweight HTTP server that proxies storage operations to JSONL or MongoDB.
 * Auto-shuts down when parent process exits.
 *
 * Supports singleton mode: call startServer() multiple times, only one server starts.
 */

import * as http from 'http';
import { mongodbStorage } from '../storage/mongodb';
import type { Storage } from '../storage/base';
import { Router } from './router';
import { EntityIdCache } from './entityIdCache';
import { createStorageHandlers } from './handlers';

export { Router } from './router';
export { EntityIdCache } from './entityIdCache';
export { createStorageHandlers } from './handlers';

export interface ServerOptions {
  port?: number;
  host?: string;
  backend: 'jsonl' | 'mongodb';
  jsonlDir?: string;
  mongoUrl?: string;
  mongoDb?: string;
}

// Singleton state
let serverInstance: http.Server | null = null;
let serverPromise: Promise<http.Server> | null = null;

const defaultOptions: ServerOptions = {
  backend: 'jsonl',
  port: 3847,
  host: 'localhost',
  jsonlDir: './data',
};

/**
 * Start the embedded API server (singleton).
 *
 * First call starts the server. Subsequent calls return the existing instance.
 * If the existing server has been closed externally, a new one will be started.
 * Use options to customize on first call only.
 */
export async function startServer(options?: Partial<ServerOptions>): Promise<http.Server> {
  // Return existing instance if it's still running
  if (serverInstance && serverInstance.listening) {
    return serverInstance;
  }

  // If a start is already in progress, wait for it
  if (serverPromise) {
    return serverPromise;
  }

  // Server was closed externally, reset the reference
  if (serverInstance) {
    serverInstance = null;
  }

  // Merge options with defaults
  const opts: ServerOptions = {
    backend: options?.mongoUrl ? 'mongodb' : (options?.backend ?? defaultOptions.backend),
    port: options?.port ?? defaultOptions.port,
    host: options?.host ?? defaultOptions.host,
    jsonlDir: options?.jsonlDir ?? defaultOptions.jsonlDir,
    mongoUrl: options?.mongoUrl,
    mongoDb: options?.mongoDb,
  };

  serverPromise = _startServer(opts);

  try {
    serverInstance = await serverPromise;
    return serverInstance;
  } finally {
    serverPromise = null;
  }
}

/**
 * Internal start that does the actual server creation (no singleton check)
 */
async function _startServer(options: ServerOptions): Promise<http.Server> {
  const port = options.port ?? 3847;
  const host = options.host ?? 'localhost';

  // Initialize storage backend
  let storage: Storage;
  let entityIdCache: EntityIdCache | undefined;

  if (options.backend === 'jsonl') {
    // Create entityId cache for JSONL
    entityIdCache = new EntityIdCache({ dir: options.jsonlDir ?? './data' });
    storage = entityIdCache.getStorage();
  } else if (options.backend === 'mongodb') {
    const adapter = await mongodbStorage({
      url: options.mongoUrl!,
      database: options.mongoDb ?? 'jotai_state_store',
    });
    storage = adapter.storage;
  } else {
    throw new Error(`Unsupported backend: ${options.backend}`);
  }

  // Create storage handlers
  const handlers = createStorageHandlers({
    getStorage: (entityId?: string) => entityIdCache
      ? entityIdCache.getStorage(entityId)
      : storage,
  });

  // Setup router
  const router = new Router();
  router.get('/storage/get/:key', handlers.handleGet);
  router.post('/storage/set/:key', handlers.handleSet);
  router.delete('/storage/delete/:key', handlers.handleDelete);
  router.post('/storage/batch-get', handlers.handleBatchGet);
  router.post('/storage/batch-set', handlers.handleBatchSet);
  router.get('/health', handlers.handleHealth);

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const matched = await router.handle(req, res);
      if (!matched) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      console.error('[bff-store] Error:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  return new Promise<http.Server>((resolve, reject) => {
    server.on('error', reject);

    server.listen(port, host, () => {
      console.log(`[bff-store] Server running on http://${host}:${port}`);
      console.log(`[bff-store] Backend: ${options.backend}`);
      resolve(server);
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
      console.log(`\n[bff-store] Received ${signal}, shutting down...`);
      server.close(() => {
        console.log('[bff-store] Server closed');
        process.exit(0);
      });

      // Force close after 5s
      setTimeout(() => {
        console.error('[bff-store] Forced shutdown');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  });
}
