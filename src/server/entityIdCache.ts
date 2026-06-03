/**
 * EntityId Cache for Multi-Tenant Storage
 *
 * Caches storage instances per entityId to avoid recreating them.
 */

import type { Storage } from '../storage/base';
import { jsonlStorage } from '../storage/jsonl';

export interface EntityIdCacheOptions {
  dir: string;
}

export class EntityIdCache {
  private cache = new Map<string, Storage>();
  private defaultStorage: Storage;
  private dir: string;

  constructor(options: EntityIdCacheOptions) {
    this.dir = options.dir;
    // Create default storage
    const adapter = jsonlStorage({ dir: options.dir });
    adapter.setEntityId('default');
    this.defaultStorage = adapter.storage;
  }

  getStorage(entityId?: string): Storage {
    if (!entityId || entityId === 'default') {
      return this.defaultStorage;
    }

    let storage = this.cache.get(entityId);
    if (storage) {
      return storage;
    }

    // Create new storage for this entityId
    const adapter = jsonlStorage({ dir: this.dir });
    adapter.setEntityId(entityId);
    storage = adapter.storage;
    this.cache.set(entityId, storage);

    return storage;
  }

  getEntityIds(): string[] {
    return Array.from(this.cache.keys());
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
