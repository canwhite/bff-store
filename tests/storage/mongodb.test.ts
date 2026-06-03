import { describe, it, expect } from 'vitest';
import type { Storage, StorageAdapter } from '../../src/storage/base';

describe('mongodbStorage interface contract', () => {
  describe('Storage interface', () => {
    it('should define complete storage interface', () => {
      const storageInterface: Storage = {
        get: async <T>(_key: string): Promise<T | null> => null,
        set: async <T>(_key: string, _value: T): Promise<void> => {},
        remove: async (_key: string): Promise<void> => {},
        getMultiple: async <T>(_keys: string[]): Promise<Map<string, T>> => new Map(),
        setMultiple: async <T>(_entries: Map<string, T>): Promise<void> => {},
      };

      expect(typeof storageInterface.get).toBe('function');
      expect(typeof storageInterface.set).toBe('function');
      expect(typeof storageInterface.remove).toBe('function');
      expect(typeof storageInterface.getMultiple).toBe('function');
      expect(typeof storageInterface.setMultiple).toBe('function');
    });
  });

  describe('StorageAdapter interface', () => {
    it('should define storage adapter with name and storage', () => {
      const adapter: StorageAdapter = {
        storage: {
          get: async <T>(_key: string): Promise<T | null> => null,
          set: async <T>(_key: string, _value: T): Promise<void> => {},
          remove: async (_key: string): Promise<void> => {},
        },
        name: 'mongodb',
      };

      expect(adapter.name).toBe('mongodb');
      expect(adapter.storage).toBeDefined();
      expect(typeof adapter.storage.get).toBe('function');
      expect(typeof adapter.storage.set).toBe('function');
    });
  });
});
