import type { AtomConfigs, Store, StoreAtoms, StoreLoadingAtoms } from './types';
import type { StorageAdapter } from './storage/base';
import { createPersistedAtom } from './atomCreator';

/**
 * Module-level promise for the auto-started server.
 * Shared across all createStore calls so concurrent invocations
 * wait on the same server instance.
 */
let serverInitPromise: Promise<unknown> | null = null;

/**
 * Creates a store with multiple persisted atoms
 *
 * @param entityId - Unique identifier for this store instance
 * @param config - Array of atom configurations
 * @param options - Store options including storage adapter
 *
 * @example
 * ```typescript
 * const config = [
 *   { key: 'theme', defaultValue: '' },
 *   { key: 'characters', defaultValue: [] },
 * ] as const;
 *
 * const adapter = jsonlStorage({ dir: './sessions' });
 *
 * const store = createStore('novel-123', config, {
 *   storage: adapter,
 * });
 * ```
 */
export function createStore(
  entityId: string,
  config: AtomConfigs,
  options?: {
    storage: StorageAdapter;
    debounceMs?: number;
  }
): Store {
  const adapter = options?.storage;
  const debounceMs = options?.debounceMs ?? 800;

  // Auto-start embedded server when using remote storage (Node.js only)
  // In browser/Next.js environments, remoteStorage connects to an already-running BFF server
  // serverInitPromise is module-level so concurrent createStore calls share the same promise
  if (adapter?.name === 'remote' && typeof window === 'undefined' && typeof process !== 'undefined') {
    import('./server').then(({ startServer }) => {
      // startServer is a singleton; concurrent calls share the same promise
      serverInitPromise = startServer().then(() => void 0).catch((err) => {
        console.error('[bff-store] Failed to auto-start server:', err);
      });
    });
  }

  if (!adapter) {
    throw new Error('Storage adapter is required');
  }

  // Initialize adapter with entityId if it supports it
  if ('setEntityId' in adapter && typeof adapter.setEntityId === 'function') {
    adapter.setEntityId(entityId);
  }

  const storage = adapter.storage;

  const atoms: StoreAtoms = {};
  const loadingAtoms: StoreLoadingAtoms = {};

  // Create atoms synchronously for immediate availability
  for (const atomConfig of config) {
    const result = createPersistedAtom(atomConfig, entityId, storage, {
      immediate: atomConfig.immediate,
      debounceMs,
    });
    atoms[atomConfig.key] = result.atom;
    loadingAtoms[atomConfig.key] = result.loadingAtom;
  }

  return {
    entityId,
    config,
    atoms,
    loadingAtoms,
  };
}

/**
 * Wait for the auto-started server to be ready.
 * Only meaningful when using remote storage in Node.js;
 * returns a resolved promise in browser environments.
 */
export function waitForServer(): Promise<void> | undefined {
  return serverInitPromise as Promise<void> | undefined;
}
