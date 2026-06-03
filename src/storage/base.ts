// ========================================
// Storage Interface
// ========================================

export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /** Optional: get multiple keys at once for batch loading */
  getMultiple?<T>(keys: string[]): Promise<Map<string, T>>;
  /** Optional: set multiple keys at once for batch saving */
  setMultiple?<T>(entries: Map<string, T>): Promise<void>;
}

// ========================================
// Storage Adapter Factory Types
// ========================================

export interface StorageAdapter {
  storage: Storage;
  name: string;
  /** Optional: set the entityId for multi-tenant storage */
  setEntityId?(entityId: string): void;
}

export type StorageFactory<T = unknown> = (options?: T) => StorageAdapter;

export type AsyncStorageFactory<T = unknown> = (options: T) => Promise<StorageAdapter>;
