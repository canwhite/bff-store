import { describe, it, expect, vi, beforeEach } from 'vitest';
import { remoteStorage } from '../../src/storage/adapters/remoteStorage';

describe('remoteStorage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic creation', () => {
    it('should create adapter with default baseUrl', () => {
      const adapter = remoteStorage();
      expect(adapter.name).toBe('remote');
      expect(adapter.storage).toBeDefined();
      expect(typeof adapter.storage.get).toBe('function');
      expect(typeof adapter.storage.set).toBe('function');
      expect(typeof adapter.storage.remove).toBe('function');
    });

    it('should create adapter with custom baseUrl', () => {
      const adapter = remoteStorage({ baseUrl: 'http://custom:9999' });
      expect(adapter.name).toBe('remote');
      expect(adapter.storage).toBeDefined();
    });

    it('should implement setEntityId', () => {
      const adapter = remoteStorage();
      expect(typeof adapter.setEntityId).toBe('function');
    });
  });

  describe('storage operations', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should call fetch for get', async () => {
      const mockResponse = {
        ok: true,
        statusText: 'OK',
        json: vi.fn().mockResolvedValue({ value: 'test-value' }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      const adapter = remoteStorage({ baseUrl: 'http://localhost:3847' });
      const result = await adapter.storage.get('theme');

      expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3847/storage/get/theme');
      expect(result).toBe('test-value');
    });

    it('should call fetch for set with POST', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      const adapter = remoteStorage();
      await adapter.storage.set('theme', 'dark');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3847/storage/set/theme',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call fetch for remove with DELETE', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      const adapter = remoteStorage();
      await adapter.storage.remove('theme');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3847/storage/delete/theme',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should handle getMultiple', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          entries: { key1: 'value1', key2: 'value2' },
        }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      const adapter = remoteStorage();
      const result = await adapter.storage.getMultiple(['key1', 'key2']);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3847/storage/batch-get',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key2')).toBe('value2');
    });

    it('should handle setMultiple', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      const adapter = remoteStorage();
      const entries = new Map([['key1', 'value1'], ['key2', 'value2']]);
      await adapter.storage.setMultiple(entries);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3847/storage/batch-set',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
