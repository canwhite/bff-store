import { describe, it, expect } from 'vitest';
import { memoryStorage } from '../../src/storage/memory';

describe('memoryStorage', () => {
  it('should return null for non-existent key', async () => {
    const adapter = memoryStorage();
    const result = await adapter.storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should set and get a value', async () => {
    const adapter = memoryStorage();
    await adapter.storage.set('key', 'value');
    const result = await adapter.storage.get('key');
    expect(result).toBe('value');
  });

  it('should overwrite existing value', async () => {
    const adapter = memoryStorage();
    await adapter.storage.set('key', 'value1');
    await adapter.storage.set('key', 'value2');
    const result = await adapter.storage.get('key');
    expect(result).toBe('value2');
  });

  it('should remove a value', async () => {
    const adapter = memoryStorage();
    await adapter.storage.set('key', 'value');
    await adapter.storage.remove('key');
    const result = await adapter.storage.get('key');
    expect(result).toBeNull();
  });

  it('should handle multiple types', async () => {
    const adapter = memoryStorage();

    await adapter.storage.set('string', 'hello');
    await adapter.storage.set('number', 42);
    await adapter.storage.set('boolean', true);
    await adapter.storage.set('array', [1, 2, 3]);
    await adapter.storage.set('object', { a: 1 });

    expect(await adapter.storage.get('string')).toBe('hello');
    expect(await adapter.storage.get('number')).toBe(42);
    expect(await adapter.storage.get('boolean')).toBe(true);
    expect(await adapter.storage.get('array')).toEqual([1, 2, 3]);
    expect(await adapter.storage.get('object')).toEqual({ a: 1 });
  });

  describe('getMultiple', () => {
    it('should return multiple values', async () => {
      const adapter = memoryStorage();
      await adapter.storage.set('key1', 'value1');
      await adapter.storage.set('key2', 'value2');
      await adapter.storage.set('key3', 'value3');

      const result = await adapter.storage.getMultiple(['key1', 'key2', 'key3']);

      expect(result.size).toBe(3);
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key2')).toBe('value2');
      expect(result.get('key3')).toBe('value3');
    });

    it('should skip non-existent keys', async () => {
      const adapter = memoryStorage();
      await adapter.storage.set('key1', 'value1');

      const result = await adapter.storage.getMultiple(['key1', 'nonexistent']);

      expect(result.size).toBe(1);
      expect(result.get('key1')).toBe('value1');
    });

    it('should return empty map for empty input', async () => {
      const adapter = memoryStorage();
      const result = await adapter.storage.getMultiple([]);
      expect(result.size).toBe(0);
    });
  });

  describe('setMultiple', () => {
    it('should set multiple values', async () => {
      const adapter = memoryStorage();
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      await adapter.storage.setMultiple(entries);

      expect(await adapter.storage.get('key1')).toBe('value1');
      expect(await adapter.storage.get('key2')).toBe('value2');
    });
  });

  it('should have correct name', () => {
    const adapter = memoryStorage();
    expect(adapter.name).toBe('memory');
  });
});
