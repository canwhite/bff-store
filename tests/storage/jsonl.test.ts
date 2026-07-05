import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { jsonlStorage } from '../../src/storage/jsonl';

describe('jsonlStorage', () => {
  const testDir = path.join(__dirname, '../../.test-jsonl');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('without entityId set', () => {
    it('should return null for get when entityId not set', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      const result = await adapter.storage.get('key');
      expect(result).toBeNull();
    });
  });

  describe('with entityId set', () => {
    it('should return null for non-existent key', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');
      const result = await adapter.storage.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should set and get a value', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');
      await adapter.storage.set('key', 'value');
      const result = await adapter.storage.get('key');
      expect(result).toBe('value');
    });

    it('should get the latest value', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');

      await adapter.storage.set('key', 'value1');
      await adapter.storage.set('key', 'value2');
      await adapter.storage.set('key', 'value3');

      const result = await adapter.storage.get('key');
      expect(result).toBe('value3');
    });

    it('should remove a key', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');

      await adapter.storage.set('key', 'value');
      await adapter.storage.remove('key');

      const result = await adapter.storage.get('key');
      expect(result).toBeNull();
    });

    it('should handle multiple entityIds', async () => {
      const adapter1 = jsonlStorage({ dir: testDir });
      const adapter2 = jsonlStorage({ dir: testDir });

      adapter1.setEntityId('entity1');
      adapter2.setEntityId('entity2');

      await adapter1.storage.set('key', 'value1');
      await adapter2.storage.set('key', 'value2');

      expect(await adapter1.storage.get('key')).toBe('value1');
      expect(await adapter2.storage.get('key')).toBe('value2');
    });

    it('should encode key in filename to avoid collision', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');

      await adapter.storage.set('key with spaces', 'value');

      // encodeURIComponent converts " " → "%20", producing a collision-safe filename
      const filePath = path.join(testDir, 'entity1', 'key%20with%20spaces.jsonl');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should not collide on keys with dots and hyphens', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');

      await adapter.storage.set('user.name', 'value1');
      await adapter.storage.set('user-name', 'value2');

      const filePath1 = path.join(testDir, 'entity1', 'user.name.jsonl');
      const filePath2 = path.join(testDir, 'entity1', 'user-name.jsonl');
      expect(fs.existsSync(filePath1)).toBe(true);
      expect(fs.existsSync(filePath2)).toBe(true);
      expect(await adapter.storage.get('user.name')).toBe('value1');
      expect(await adapter.storage.get('user-name')).toBe('value2');
    });

    it('should handle multiple types', async () => {
      const adapter = jsonlStorage({ dir: testDir });
      adapter.setEntityId('entity1');

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
        const adapter = jsonlStorage({ dir: testDir });
        adapter.setEntityId('entity1');

        await adapter.storage.set('key1', 'value1');
        await adapter.storage.set('key2', 'value2');
        await adapter.storage.set('key3', 'value3');

        const result = await adapter.storage.getMultiple(['key1', 'key2', 'key3']);

        expect(result.size).toBe(3);
        expect(result.get('key1')).toBe('value1');
        expect(result.get('key2')).toBe('value2');
        expect(result.get('key3')).toBe('value3');
      });
    });

    it('should have correct name', () => {
      const adapter = jsonlStorage({ dir: testDir });
      expect(adapter.name).toBe('jsonl');
    });
  });
});
