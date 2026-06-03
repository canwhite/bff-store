import { Storage, StorageAdapter, StorageFactory } from './base';
import type { MemoryStorageOptions } from '../types';

/**
 * In-memory storage adapter for development and testing
 */
export function memoryStorage(
  _options?: MemoryStorageOptions
): StorageAdapter {
  const store = new Map<string, unknown>();

  const storage: Storage = {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T) ?? null;
    },

    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },

    async remove(key: string): Promise<void> {
      store.delete(key);
    },

    async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
      const result = new Map<string, T>();
      for (const key of keys) {
        const value = store.get(key) as T;
        if (value !== undefined) {
          result.set(key, value);
        }
      }
      return result;
    },

    async setMultiple<T>(entries: Map<string, T>): Promise<void> {
      entries.forEach((value, key) => {
        store.set(key, value);
      });
    },
  };

  return {
    storage,
    name: 'memory',
  };
}

export const createMemoryStorage: StorageFactory<MemoryStorageOptions> = memoryStorage;
