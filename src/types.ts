import type { WritableAtom, Atom } from 'jotai';

// ========================================
// Atom Configuration Types
// ========================================

export type AtomType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface AtomConfig<T = unknown> {
  key: string;
  defaultValue: T;
  type?: AtomType;
  /** If true, save immediately without debounce */
  immediate?: boolean;
}

export type AtomConfigs = readonly AtomConfig[];

// ========================================
// Store Types
// ========================================

export interface PersistedAtomWithLoading<T> {
  atom: WritableAtom<T, [update: T | ((prev: T) => T)], void>;
  loadingAtom: Atom<boolean>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StoreAtoms = Record<string, WritableAtom<any, [any], void>>;
export type StoreLoadingAtoms = Record<string, Atom<boolean>>;

export interface Store {
  entityId: string;
  config: AtomConfigs;
  atoms: StoreAtoms;
  loadingAtoms: StoreLoadingAtoms;
}

// ========================================
// Hook Return Types
// ========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseStoreReturn = Record<string, any> & {
  isLoading: boolean;
};

// ========================================
// Storage Options
// ========================================

export interface StorageOptions {
  debounceMs?: number;
}

export interface JsonlStorageOptions extends StorageOptions {
  dir?: string;
}

export interface MongoStorageOptions extends StorageOptions {
  url: string;
  database?: string;
}

export interface MemoryStorageOptions extends StorageOptions {}

// ========================================
// Backend Config (shared between protocol and handlers)
// ========================================

export interface BackendConfig {
  backend?: 'mongodb' | 'jsonl';
  mongoUrl?: string;
  mongoDb?: string;
  jsonlDir?: string;
}
