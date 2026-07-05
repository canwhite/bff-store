/**
 * Transport Adapter Interface
 *
 * Abstracts the transport layer for remote storage operations.
 * Can be implemented as HTTP, WebSocket, or other protocols.
 */

export interface TransportAdapter {
  /** GET request */
  get<T>(url: string): Promise<T>;
  /** POST request with JSON body */
  post<T, R>(url: string, body: T): Promise<R>;
  /** DELETE request */
  delete(url: string): Promise<void>;
}

/**
 * HTTP Transport Adapter using fetch
 */
export class HttpTransport implements TransportAdapter {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.clone().json();
        detail = body?.error ?? body?.message ?? detail;
      } catch {
        // body is not JSON or unreadable, use statusText only
      }
      throw new Error(`GET ${url} failed: ${detail}`);
    }
    return res.json();
  }

  async post<T, R>(url: string, body: T): Promise<R> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const errBody = await res.clone().json();
        detail = errBody?.error ?? errBody?.message ?? detail;
      } catch {
        // body is not JSON or unreadable, use statusText only
      }
      throw new Error(`POST ${url} failed: ${detail}`);
    }
    return res.json();
  }

  async delete(url: string): Promise<void> {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const errBody = await res.clone().json();
        detail = errBody?.error ?? errBody?.message ?? detail;
      } catch {
        // body is not JSON or unreadable, use statusText only
      }
      throw new Error(`DELETE ${url} failed: ${detail}`);
    }
  }
}

/**
 * Create a StorageAdapter that wraps a TransportAdapter and base URL
 */
import type { Storage, StorageAdapter } from './base';

export function createStorageFromTransport(
  transport: TransportAdapter,
  baseUrl: string
): Storage {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const res = await transport.get<{ value: T }>(`${baseUrl}/storage/get/${encodeURIComponent(key)}`);
        return res.value;
      } catch (err: any) {
        if (err.message.includes('failed')) {
          return null;
        }
        throw err;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      await transport.post(`${baseUrl}/storage/set/${encodeURIComponent(key)}`, { value });
    },

    async remove(key: string): Promise<void> {
      await transport.delete(`${baseUrl}/storage/delete/${encodeURIComponent(key)}`);
    },

    async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
      const res = await transport.post<{ keys: string[] }, { entries: Record<string, T> }>(
        `${baseUrl}/storage/batch-get`,
        { keys }
      );
      return new Map(Object.entries(res.entries));
    },

    async setMultiple<T>(entries: Map<string, T>): Promise<void> {
      const obj: Record<string, T> = {};
      entries.forEach((value, key) => {
        obj[key] = value;
      });
      await transport.post(`${baseUrl}/storage/batch-set`, { entries: obj });
    },
  };
}
