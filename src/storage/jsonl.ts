import * as fs from 'fs';
import * as path from 'path';
import { Storage, StorageAdapter, StorageFactory } from './base';
import type { JsonlStorageOptions } from '../types';

interface JsonlEntry {
  key: string;
  value: unknown;
  timestamp: number;
}

interface JsonlStorageInstance extends StorageAdapter {
  storage: Storage;
  setEntityId(id: string): void;
}

/**
 * JSONL file storage adapter
 * Stores data as {dir}/{entityId}/{key}.jsonl
 * Each line is a JSON object with key, value, and timestamp
 *
 * Usage:
 *   const adapter = jsonlStorage({ dir: './sessions' });
 *   adapter.setEntityId('user-123');
 *   const store = createStore('user-123', config, { storage: adapter.storage });
 */
export function jsonlStorage(options?: JsonlStorageOptions): JsonlStorageInstance {
  const baseDir = options?.dir ?? './sessions';
  let entityId: string = 'default';

  function getFilePath(eId: string, key: string): string {
    // Use encodeURIComponent to avoid key collision:
    // "user.name", "user-name", "user%2Ename" all produce distinct filenames
    const safeKey = encodeURIComponent(key);
    return path.join(baseDir, eId, `${safeKey}.jsonl`);
  }

  const storage: Storage = {
    async get<T>(key: string): Promise<T | null> {
      if (!entityId) return null;

      const filePath = getFilePath(entityId, key);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        if (lines.length === 0) return null;

        // Read the last line for the latest value
        const lastLine = lines[lines.length - 1];
        const entry: JsonlEntry = JSON.parse(lastLine);
        return entry.value as T;
      } catch {
        return null;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      if (!entityId) return;

      const filePath = getFilePath(entityId, key);
      const dir = path.dirname(filePath);

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const entry: JsonlEntry = {
        key,
        value,
        timestamp: Date.now(),
      };

      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filePath, line, 'utf-8');
    },

    async remove(key: string): Promise<void> {
      if (!entityId) return;

      const filePath = getFilePath(entityId, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },

    async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
      const result = new Map<string, T>();
      for (const key of keys) {
        const value = await this.get<T>(key);
        if (value !== null) {
          result.set(key, value);
        }
      }
      return result;
    },
  };

  return {
    storage,
    name: 'jsonl',
    setEntityId(id: string) {
      entityId = id;
    },
  };
}

export const createJsonlStorage: StorageFactory<JsonlStorageOptions> = jsonlStorage;
