// ========================================
// Main Export
// ========================================

export { createStore, waitForServer } from './createStore';
export { useStore } from './useStore';
export { createPersistedAtom } from './atomCreator';

// ========================================
// Types
// ========================================

export type {
  AtomConfig,
  AtomConfigs,
  AtomType,
  Store,
  StorageOptions,
  MemoryStorageOptions,
  UseStoreReturn,
} from './types';

// ========================================
// Storage Adapters
// ========================================

export { memoryStorage, createMemoryStorage } from './storage/memory';
export { remoteStorage, createRemoteStorage } from './storage/adapters/remoteStorage';
export type { Storage, StorageAdapter, StorageFactory, AsyncStorageFactory } from './storage/base';

// Transport & Protocol
export { HttpTransport, createStorageFromTransport } from './storage/transport';
export { RestStorageProtocol, createStorageWithProtocol } from './storage/protocol';
export type { TransportAdapter } from './storage/transport';
export type { StorageHttpProtocol } from './storage/protocol';

// ========================================
// Node.js Utilities
// ========================================

export { isNode, isBrowser } from './environment';
export { createNodeStore } from './nodeStore';
