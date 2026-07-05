import { atom, getDefaultStore } from 'jotai';
import type { AtomConfig, PersistedAtomWithLoading } from './types';
import type { Storage } from './storage/base';
import { DebouncerMap } from './debouncer';

/**
 * Module-level debouncer map for all persisted atoms.
 * Each unique key (atom config key) gets its own debouncer.
 */
const debouncerMap = new DebouncerMap();

/**
 * Creates a persisted atom with loading state tracking
 */
export function createPersistedAtom<T>(
  config: AtomConfig<T>,
  entityId: string,
  storage: Storage,
  options?: { immediate?: boolean; debounceMs?: number }
): PersistedAtomWithLoading<T> {
  const baseAtom = atom<T>(config.defaultValue);
  const loadingAtom = atom<boolean>(true);

  // Load initial value on mount
  baseAtom.onMount = (setValue) => {
    storage
      .get<T>(config.key)
      .then((value) => {
        if (value !== null && value !== undefined) {
          setValue(value);
        }
      })
      .catch((err) => {
        console.error(`[bff-store] Failed to load atom "${config.key}":`, err);
      })
      .finally(() => {
        // Mark as loaded regardless of success or failure
        setTimeout(() => {
          const store = getDefaultStore();
          store.set(loadingAtom, false);
        }, 0);
      });

    // Cancel pending debounced write on unmount to avoid writes from a destroyed component
    return () => {
      const debounceKey = `${entityId}:${config.key}`;
      debouncerMap.cancel(debounceKey);
    };
  };

  // Create write atom with persistence
  const writeAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: T | ((prev: T) => T)) => {
      const newValue =
        typeof update === 'function'
          ? (update as (prev: T) => T)(get(baseAtom))
          : update;

      // Update local state first
      set(baseAtom, newValue);

      // Save to storage
      if (options?.immediate) {
        // Immediate save for critical data
        storage.set(config.key, newValue).catch(console.error);
      } else {
        // Debounced save for normal data
        // Use entityId:key as the debounce key to avoid cross-store interference
        const debounceKey = `${entityId}:${config.key}`;
        const debounceMs = options?.debounceMs ?? 800;
        const saveFn = () => {
          storage.set(config.key, newValue).catch(console.error);
        };
        debouncerMap.debounce(debounceKey, saveFn, debounceMs);
      }
    }
  );

  return {
    atom: writeAtom,
    loadingAtom,
  };
}
