import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { startServer } from '../src/server';

describe('server', () => {
  let server: http.Server;
  const testDir = path.join(__dirname, '../.test-server-data');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('health check', () => {
    it('should return ok', async () => {
      server = await startServer({
        backend: 'jsonl',
        jsonlDir: testDir,
        port: 3849,
      });

      const response = await fetch('http://localhost:3849/health');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
    });
  });

  describe('storage operations', () => {
    beforeEach(async () => {
      server = await startServer({
        backend: 'jsonl',
        jsonlDir: testDir,
        port: 3849,
      });
    });

    it('should set and get a value', async () => {
      await fetch('http://localhost:3849/storage/set/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'dark' }),
      });

      const response = await fetch('http://localhost:3849/storage/get/theme');
      const data = await response.json();

      expect(data.value).toBe('dark');
    });

    it('should delete a value', async () => {
      await fetch('http://localhost:3849/storage/set/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'dark' }),
      });

      await fetch('http://localhost:3849/storage/delete/theme', {
        method: 'DELETE',
      });

      const response = await fetch('http://localhost:3849/storage/get/theme');
      const data = await response.json();

      expect(data.value).toBeNull();
    });

    it('should return 404 for unknown paths', async () => {
      const response = await fetch('http://localhost:3849/unknown');
      expect(response.status).toBe(404);
    });

    it('should handle batch-get', async () => {
      await fetch('http://localhost:3849/storage/set/key1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'value1' }),
      });
      await fetch('http://localhost:3849/storage/set/key2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'value2' }),
      });

      const response = await fetch('http://localhost:3849/storage/batch-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: ['key1', 'key2'] }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries.key1).toBe('value1');
      expect(data.entries.key2).toBe('value2');
    });

    it('should handle batch-set', async () => {
      const response = await fetch('http://localhost:3849/storage/batch-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: { key1: 'value1', key2: 'value2' } }),
      });

      expect(response.status).toBe(200);

      const get1 = await fetch('http://localhost:3849/storage/get/key1');
      const d1 = await get1.json();
      expect(d1.value).toBe('value1');

      const get2 = await fetch('http://localhost:3849/storage/get/key2');
      const d2 = await get2.json();
      expect(d2.value).toBe('value2');
    });

    it('should handle batch-get with entityId', async () => {
      await fetch('http://localhost:3849/storage/set/user-key1?entityId=user-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'user1-value1' }),
      });

      const response = await fetch('http://localhost:3849/storage/batch-get?entityId=user-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: ['user-key1'] }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries['user-key1']).toBe('user1-value1');
    });

    it('should handle batch-set with entityId', async () => {
      const response = await fetch('http://localhost:3849/storage/batch-set?entityId=user-2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: { 'user-key': 'user2-value' } }),
      });

      expect(response.status).toBe(200);

      const get = await fetch('http://localhost:3849/storage/get/user-key?entityId=user-2');
      const d = await get.json();
      expect(d.value).toBe('user2-value');
    });
  });
});
