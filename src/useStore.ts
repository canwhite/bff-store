import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { getDefaultStore } from 'jotai';
import type { Store, UseStoreReturn } from './types';

/**
 * React Hook to use a store
 *
 * @example
 * ```typescript
 * const store = createStore('user-123', [
 *   { key: 'name', defaultValue: '' },
 *   { key: 'age', defaultValue: 0 },
 * ], { storage });
 *
 * function UserProfile() {
 *   const { name, age, setName, setAge, isLoading } = useStore(store);
 *   // ...
 * }
 * ```
 */
export function useStore(store: Store): UseStoreReturn {
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to loading states
  useEffect(() => {
    const storeInstance = getDefaultStore();
    const loadingAtoms = Object.values(store.loadingAtoms);

    if (loadingAtoms.length === 0) {
      setIsLoading(false);
      return;
    }

    const checkLoadingStatus = () => {
      const loadingStates = loadingAtoms.map((atom) => storeInstance.get(atom));
      const anyLoading = loadingStates.some((loading) => loading === true);
      setIsLoading(anyLoading);
    };

    checkLoadingStatus();

    const unsubscribers = loadingAtoms.map((atom) =>
      storeInstance.sub(atom, checkLoadingStatus)
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [store.loadingAtoms]);

  // Build a dynamic result based on config
  // Note: React hooks must be called unconditionally and in the same order
  const result = buildStoreResult(store, isLoading);

  return result;
}

/**
 * Build store result object - calls useAtom for each atom
 * This must be called unconditionally with the same atoms each render
 */
function buildStoreResult(store: Store, isLoading: boolean): UseStoreReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { isLoading };

  // Iterate over store.config which is always stable
  // Each config always has a corresponding atom in store.atoms (created together in createStore)
  for (let i = 0; i < store.config.length; i++) {
    const config = store.config[i];
    const atom = store.atoms[config.key];
    // atom always exists - created in createStore for every config
    const [value, setter] = useAtom(atom);
    result[config.key] = value;
    result[`set${capitalize(config.key)}`] = setter;
  }

  return result;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
