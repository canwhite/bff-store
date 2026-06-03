import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { createPersistedAtom } from '../src/atomCreator';
import type { Storage } from '../src/storage/base';

function createMockStorage(initialData: Record<string, unknown> = {}): Storage {
  const data = new Map(Object.entries(initialData));
  return {
    async get<T>(key: string): Promise<T | null> {
      return (data.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, value);
    },
    async remove(key: string): Promise<void> {
      data.delete(key);
    },
  };
}

describe('createPersistedAtom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('basic creation', () => {
    it('should create atom with default value', () => {
      const storage = createMockStorage();
      const result = createPersistedAtom(
        { key: 'theme', defaultValue: 'dark' },
        storage
      );

      expect(result.atom).toBeDefined();
      expect(result.loadingAtom).toBeDefined();
    });

    it('should have different atoms for different keys', () => {
      const storage = createMockStorage();
      const result1 = createPersistedAtom({ key: 'a', defaultValue: 1 }, storage);
      const result2 = createPersistedAtom({ key: 'b', defaultValue: 2 }, storage);

      expect(result1.atom).not.toBe(result2.atom);
      expect(result1.loadingAtom).not.toBe(result2.loadingAtom);
    });

    it('should have loading atom starting as true', () => {
      const storage = createMockStorage();
      const { loadingAtom } = createPersistedAtom(
        { key: 'theme', defaultValue: 'dark' },
        storage
      );

      const store = getDefaultStore();
      expect(store.get(loadingAtom)).toBe(true);
    });
  });

  describe('atom read', () => {
    it('should return default value via read', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'theme', defaultValue: 'dark' },
        storage
      );

      const store = getDefaultStore();
      expect(store.get(persistedAtom)).toBe('dark');
    });
  });

  describe('atom write with immediate', () => {
    it('should update value immediately in store', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'theme', defaultValue: 'dark', immediate: true },
        storage
      );

      const store = getDefaultStore();
      store.set(persistedAtom, 'light');
      expect(store.get(persistedAtom)).toBe('light');
    });
  });

  describe('atom write with debounce', () => {
    it('should update value in store immediately', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'theme', defaultValue: 'dark', immediate: false },
        storage
      );

      const store = getDefaultStore();
      store.set(persistedAtom, 'light');
      expect(store.get(persistedAtom)).toBe('light');
    });
  });

  describe('function updates', () => {
    it('should handle function updates correctly', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'count', defaultValue: 5 },
        storage
      );

      const store = getDefaultStore();
      expect(store.get(persistedAtom)).toBe(5);

      store.set(persistedAtom, (prev) => (prev as number) + 1);
      expect(store.get(persistedAtom)).toBe(6);
    });
  });

  describe('type handling', () => {
    it('should handle string type', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'name', defaultValue: '', type: 'string' },
        storage
      );
      expect(persistedAtom).toBeDefined();
    });

    it('should handle number type', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'count', defaultValue: 0, type: 'number' },
        storage
      );
      expect(persistedAtom).toBeDefined();
    });

    it('should handle array type', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'items', defaultValue: [], type: 'array' },
        storage
      );
      expect(persistedAtom).toBeDefined();
    });

    it('should handle object type', () => {
      const storage = createMockStorage();
      const { atom: persistedAtom } = createPersistedAtom(
        { key: 'data', defaultValue: {}, type: 'object' },
        storage
      );
      expect(persistedAtom).toBeDefined();
    });
  });
});
