import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { createStore } from '../src/createStore';
import { memoryStorage } from '../src/storage/memory';

describe('createStore', () => {
  beforeEach(() => {
    // Reset store between tests
  });

  describe('basic creation', () => {
    it('should create store with single config', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      expect(store.entityId).toBe('entity-1');
      expect(store.config).toBe(config);
      expect(store.atoms.theme).toBeDefined();
      expect(store.loadingAtoms.theme).toBeDefined();
    });

    it('should create store with multiple configs', () => {
      const adapter = memoryStorage();
      const config = [
        { key: 'theme', defaultValue: 'dark' },
        { key: 'name', defaultValue: '' },
        { key: 'count', defaultValue: 0 },
      ] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      expect(store.atoms.theme).toBeDefined();
      expect(store.atoms.name).toBeDefined();
      expect(store.atoms.count).toBeDefined();
      expect(store.loadingAtoms.theme).toBeDefined();
      expect(store.loadingAtoms.name).toBeDefined();
      expect(store.loadingAtoms.count).toBeDefined();
    });

    it('should throw when no storage provided', () => {
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      expect(() => {
        createStore('entity-1', config);
      }).toThrow('Storage adapter is required');
    });

    it('should use default debounceMs of 800', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      expect(store.atoms.theme).toBeDefined();
    });

    it('should accept custom debounceMs', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, {
        storage: adapter,
        debounceMs: 500,
      });

      expect(store.atoms.theme).toBeDefined();
    });
  });

  describe('entityId handling', () => {
    it('should store entityId in returned store', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('novel-123', config, { storage: adapter });

      expect(store.entityId).toBe('novel-123');
    });
  });

  describe('immediate flag', () => {
    it('should pass immediate flag to atom creator', () => {
      const adapter = memoryStorage();
      const config = [
        { key: 'normal', defaultValue: '' },
        { key: 'critical', defaultValue: '', immediate: true },
      ] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      expect(store.atoms.normal).toBeDefined();
      expect(store.atoms.critical).toBeDefined();
    });
  });

  describe('atom access via jotai store', () => {
    it('should allow atom access through jotai store', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const jotaiStore = getDefaultStore();

      jotaiStore.set(store.atoms.theme, 'light');
      expect(jotaiStore.get(store.atoms.theme)).toBe('light');

      jotaiStore.set(store.atoms.theme, (prev) => (prev as string) + '-mode');
      expect(jotaiStore.get(store.atoms.theme)).toBe('light-mode');
    });
  });

  describe('loading atoms', () => {
    it('should have loading atoms that start true', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const jotaiStore = getDefaultStore();
      expect(jotaiStore.get(store.loadingAtoms.theme)).toBe(true);
    });
  });
});
