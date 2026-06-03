import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../src/useStore';
import { createStore } from '../src/createStore';
import { memoryStorage } from '../src/storage/memory';

const originalWarn = console.warn;
beforeEach(() => {
  console.warn = () => {};
});
afterEach(() => {
  console.warn = originalWarn;
});

describe('useStore', () => {
  describe('basic usage', () => {
    it('should return store values and setters', () => {
      const adapter = memoryStorage();
      const config = [
        { key: 'theme', defaultValue: 'dark' },
        { key: 'name', defaultValue: 'John' },
      ] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(result.current.theme).toBe('dark');
      expect(result.current.name).toBe('John');
      expect(typeof result.current.setTheme).toBe('function');
      expect(typeof result.current.setName).toBe('function');
    });

    it('should include isLoading', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect('isLoading' in result.current).toBe(true);
    });

    it('should update value when atom changes', async () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      await act(async () => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('setter naming', () => {
    it('should derive setter name by capitalizing first letter', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(typeof result.current.setTheme).toBe('function');
    });

    it('should handle camelCase keys', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'userName', defaultValue: '' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(typeof result.current.setUserName).toBe('function');
    });

    it('should handle single character keys', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'x', defaultValue: 0 }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(typeof result.current.setX).toBe('function');
    });
  });

  describe('with empty config', () => {
    it('should return only isLoading', () => {
      const adapter = memoryStorage();
      const config = [] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(result.current.isLoading).toBeDefined();
      const keys = Object.keys(result.current).filter((k) => k !== 'isLoading');
      expect(keys).toHaveLength(0);
    });
  });

  describe('loading state', () => {
    it('should initially show loading state', () => {
      const adapter = memoryStorage();
      const config = [{ key: 'theme', defaultValue: 'dark' }] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('multiple atoms', () => {
    it('should handle many atoms', () => {
      const adapter = memoryStorage();
      const config = [
        { key: 'a', defaultValue: 1 },
        { key: 'b', defaultValue: 2 },
        { key: 'c', defaultValue: 3 },
        { key: 'd', defaultValue: 4 },
        { key: 'e', defaultValue: 5 },
      ] as const;

      const store = createStore('entity-1', config, { storage: adapter });

      const { result } = renderHook(() => useStore(store));

      expect(result.current.a).toBe(1);
      expect(result.current.b).toBe(2);
      expect(result.current.c).toBe(3);
      expect(result.current.d).toBe(4);
      expect(result.current.e).toBe(5);
    });
  });
});
