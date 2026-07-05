/**
 * Storage Handlers
 *
 * Request handlers for storage operations with caching for dynamic storage adapters.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Storage, StorageAdapter } from '../storage/base';
import type { BackendConfig } from '../types';
import { jsonlStorage } from '../storage/jsonl';
import { mongodbStorage } from '../storage/mongodb';

export interface StorageHandlersOptions {
  getStorage: (entityId?: string) => Storage;
}

interface CacheEntry {
  adapter: StorageAdapter;
  lastUsed: number;
}

// Storage adapter cache - keyed by backend+mongoUrl or backend+jsonlDir
const storageCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 10;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(config: BackendConfig): string {
  if (config.backend === 'mongodb') {
    return `mongodb:${config.mongoUrl}:${config.mongoDb ?? 'default'}`;
  }
  if (config.backend === 'jsonl') {
    return `jsonl:${config.jsonlDir ?? './data'}`;
  }
  return 'default';
}

function getBackendConfig(req: IncomingMessage): BackendConfig {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return {
    backend: (url.searchParams.get('backend') as 'mongodb' | 'jsonl') ?? undefined,
    mongoUrl: url.searchParams.get('mongoUrl') ?? undefined,
    mongoDb: url.searchParams.get('mongoDb') ?? undefined,
    jsonlDir: url.searchParams.get('jsonlDir') ?? undefined,
  };
}

function getEntityId(req: IncomingMessage): string | undefined {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.searchParams.get('entityId') ?? undefined;
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return JSON.parse(body);
}

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of storageCache.entries()) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      storageCache.delete(key);
    }
  }
}

async function getCachedStorage(config: BackendConfig, entityId?: string): Promise<Storage> {
  const key = getCacheKey(config);

  // Check cache
  if (storageCache.has(key)) {
    const entry = storageCache.get(key)!;
    entry.lastUsed = Date.now();

    // Set entityId if provided
    if (entityId && 'setEntityId' in entry.adapter && typeof entry.adapter.setEntityId === 'function') {
      entry.adapter.setEntityId(entityId);
    }
    return entry.adapter.storage;
  }

  // Evict oldest entries until there's space for a new one
  while (storageCache.size >= MAX_CACHE_SIZE && storageCache.size > 0) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, entry] of storageCache.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      storageCache.delete(oldestKey);
    } else {
      break; // should not happen, but guard against infinite loop
    }
  }

  // Create new adapter
  let adapter: StorageAdapter;
  if (config.backend === 'mongodb') {
    if (!config.mongoUrl) {
      throw new Error('mongoUrl is required for mongodb backend');
    }
    adapter = await mongodbStorage({
      url: config.mongoUrl,
      database: config.mongoDb ?? 'jotai_state_store',
    });
  } else if (config.backend === 'jsonl') {
    adapter = jsonlStorage({ dir: config.jsonlDir ?? './data' });
  } else {
    throw new Error('Unknown backend type');
  }

  // Set entityId if provided
  if (entityId && 'setEntityId' in adapter && typeof adapter.setEntityId === 'function') {
    adapter.setEntityId(entityId);
  }

  // Cache it
  storageCache.set(key, { adapter, lastUsed: Date.now() });

  return adapter.storage;
}

export function createStorageHandlers(options: StorageHandlersOptions) {
  const { getStorage } = options;

  // Resolve storage based on request - parses body only once for POST/PATCH methods
  async function resolveStorage(req: IncomingMessage): Promise<{ storage: Storage; body: Record<string, unknown> | null }> {
    const entityId = getEntityId(req);
    const urlConfig = getBackendConfig(req);
    let body: Record<string, unknown> | null = null;

    // For POST/PUT/PATCH methods, parse body to get backend config
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        body = await parseBody<Record<string, unknown>>(req);
      } catch {
        // Ignore parse errors - fall back to urlConfig only
        console.warn('[bff-store] Failed to parse request body, using URL config only');
      }
    }

    const config: BackendConfig = body
      ? {
          backend: (body.backend as 'mongodb' | 'jsonl') ?? urlConfig.backend,
          mongoUrl: (body.mongoUrl as string) ?? urlConfig.mongoUrl,
          mongoDb: (body.mongoDb as string) ?? urlConfig.mongoDb,
          jsonlDir: (body.jsonlDir as string) ?? urlConfig.jsonlDir,
        }
      : urlConfig;

    // If backend is specified, use dynamic storage
    if (config.backend) {
      cleanExpiredCache();
      const storage = await getCachedStorage(config, entityId);
      return { storage, body };
    }

    // Otherwise use default storage
    return { storage: getStorage(entityId), body };
  }

  async function handleGet(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
    const { storage } = await resolveStorage(req);
    const value = await storage.get(params?.key ?? '');

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ value }));
  }

  async function handleSet(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
    const { storage, body } = await resolveStorage(req);
    const value = body?.value as unknown;
    await storage.set(params?.key ?? '', value);

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  }

  async function handleDelete(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
    const { storage } = await resolveStorage(req);
    await storage.remove(params?.key ?? '');

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  }

  async function handleBatchGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { storage, body } = await resolveStorage(req);
    const keys = (body?.keys as string[]) ?? [];

    let result: Map<string, unknown>;
    if (storage.getMultiple) {
      result = await storage.getMultiple(keys);
    } else {
      result = new Map();
      for (const key of keys) {
        const value = await storage.get(key);
        if (value !== null) {
          result.set(key, value);
        }
      }
    }

    const entries: Record<string, unknown> = {};
    result.forEach((value, key) => {
      entries[key] = value;
    });

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ entries }));
  }

  async function handleBatchSet(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { storage, body } = await resolveStorage(req);
    const entries = (body?.entries as Record<string, unknown>) ?? {};

    if (storage.setMultiple) {
      const map = new Map(Object.entries(entries));
      await storage.setMultiple(map);
    } else {
      for (const [key, value] of Object.entries(entries)) {
        await storage.set(key, value);
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  }

  async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
  }

  return {
    handleGet,
    handleSet,
    handleDelete,
    handleBatchGet,
    handleBatchSet,
    handleHealth,
  };
}
