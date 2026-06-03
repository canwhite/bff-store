import { getDefaultStore } from 'jotai';
import { createStore } from './createStore';
import type { AtomConfigs, StoreAtoms, StoreLoadingAtoms } from './types';
import type { StorageAdapter } from './storage/base';

/**
 * Create a store for Node.js environments.
 *
 * @example
 * ```typescript
 * import { jsonlStorage } from 'bff-store/jsonl';
 * import { createNodeStore } from 'bff-store';
 *
 * const store = createNodeStore('entity-123', [
 *   { key: 'theme', defaultValue: 'dark' },
 * ], {
 *   storage: jsonlStorage({ dir: './sessions' }),
 * });
 *
 * await store.waitForLoad();
 *
 * const jotai = getDefaultStore();
 * jotai.set(store.atoms.theme, 'light');
 * ```
 */
export function createNodeStore(
  entityId: string,
  config: AtomConfigs,
  options: {
    storage: StorageAdapter;
    debounceMs?: number;
  }
): {
  /** Atoms to use with getDefaultStore().get/set */
  atoms: StoreAtoms;
  /** Loading state atoms */
  loadingAtoms: StoreLoadingAtoms;
  /**
   * Wait for all atoms to finish loading from storage.
   * Call this after creating the store to ensure data is ready.
   */
  waitForLoad(): Promise<void>;
} {
  const store = createStore(entityId, config, options);
  const jotaiStore = getDefaultStore();

  async function waitForLoad(): Promise<void> {
    // Trigger onMount for all atoms by subscribing to them
    // In Node.js, sub() triggers onMount (unlike get() which doesn't)
    for (const atom of Object.values(store.atoms)) {
      jotaiStore.sub(atom, () => {});
    }

    // Now wait for all loading atoms to become false
    return new Promise((resolve) => {
      const loadingAtoms = Object.values(store.loadingAtoms);
      const stillLoading = () => loadingAtoms.some((atom) => jotaiStore.get(atom));

      if (!stillLoading()) {
        resolve();
        return;
      }

      // Poll until all are loaded
      const interval = setInterval(() => {
        if (!stillLoading()) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });
  }

  return {
    atoms: store.atoms,
    loadingAtoms: store.loadingAtoms,
    waitForLoad,
  };
}
