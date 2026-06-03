/**
 * Storage HTTP Protocol Interface
 *
 * Defines the request/response contract for storage operations over HTTP.
 * This allows the protocol to be implemented differently without changing
 * the storage semantics.
 */

import type { TransportAdapter } from './transport';
import type { BackendConfig } from '../types';
export type { BackendConfig } from '../types';

export interface StorageHttpProtocol {
  /** Build URL for get operation */
  buildGetUrl(key: string): string;
  /** Build URL for set operation */
  buildSetUrl(key: string): string;
  /** Build URL for delete operation */
  buildDeleteUrl(key: string): string;
  /** Build URL for batch get */
  buildBatchGetUrl(): string;
  /** Build URL for batch set */
  buildBatchSetUrl(): string;
  /** Get backend config */
  getBackendConfig(): BackendConfig;
}

/**
 * Default protocol implementation using standard REST paths
 */
export class RestStorageProtocol implements StorageHttpProtocol {
  constructor(
    private baseUrl: string,
    private entityId?: string | { current?: string },
    private backendConfig: BackendConfig = {}
  ) {}

  private getEntityId(): string | undefined {
    return typeof this.entityId === 'object' ? this.entityId.current : this.entityId;
  }

  private appendBackendParams(params: URLSearchParams): void {
    if (this.backendConfig.backend) {
      params.set('backend', this.backendConfig.backend);
    }
    if (this.backendConfig.mongoUrl) {
      params.set('mongoUrl', this.backendConfig.mongoUrl);
    }
    if (this.backendConfig.mongoDb) {
      params.set('mongoDb', this.backendConfig.mongoDb);
    }
    if (this.backendConfig.jsonlDir) {
      params.set('jsonlDir', this.backendConfig.jsonlDir);
    }
  }

  private buildUrl(path: string, key: string): string {
    const url = `${this.baseUrl}${path}${encodeURIComponent(key)}`;
    const params = new URLSearchParams();
    const eid = this.getEntityId();
    if (eid) {
      params.set('entityId', eid);
    }
    this.appendBackendParams(params);
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  buildGetUrl(key: string): string {
    return this.buildUrl('/storage/get/', key);
  }

  buildSetUrl(key: string): string {
    return this.buildUrl('/storage/set/', key);
  }

  buildDeleteUrl(key: string): string {
    return this.buildUrl('/storage/delete/', key);
  }

  buildBatchGetUrl(): string {
    const url = `${this.baseUrl}/storage/batch-get`;
    const params = new URLSearchParams();
    const eid = this.getEntityId();
    if (eid) {
      params.set('entityId', eid);
    }
    this.appendBackendParams(params);
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  buildBatchSetUrl(): string {
    const url = `${this.baseUrl}/storage/batch-set`;
    const params = new URLSearchParams();
    const eid = this.getEntityId();
    if (eid) {
      params.set('entityId', eid);
    }
    this.appendBackendParams(params);
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  getBackendConfig(): BackendConfig {
    return this.backendConfig;
  }

  withEntityId(entityId: string): RestStorageProtocol {
    return new RestStorageProtocol(this.baseUrl, entityId, this.backendConfig);
  }
}

/**
 * Create a storage that uses a specific protocol
 */
export function createStorageWithProtocol(
  transport: TransportAdapter,
  protocol: StorageHttpProtocol
): {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getMultiple<T>(keys: string[]): Promise<Map<string, T>>;
  setMultiple<T>(entries: Map<string, T>): Promise<void>;
} {
  // Get backend config from protocol if available
  const backendConfig = 'getBackendConfig' in protocol
    ? protocol.getBackendConfig()
    : {};

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const res = await transport.get<{ value: T }>(protocol.buildGetUrl(key));
        return res.value;
      } catch (err: any) {
        if (err.message.includes('failed')) {
          return null;
        }
        throw err;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const body: Record<string, unknown> = { value, ...backendConfig };
      await transport.post(protocol.buildSetUrl(key), body);
    },

    async remove(key: string): Promise<void> {
      await transport.delete(protocol.buildDeleteUrl(key));
    },

    async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
      const res = await transport.post<{ keys: string[] }, { entries: Record<string, T> }>(
        protocol.buildBatchGetUrl(),
        { keys, ...backendConfig }
      );
      return new Map(Object.entries(res.entries));
    },

    async setMultiple<T>(entries: Map<string, T>): Promise<void> {
      const obj: Record<string, T> = {};
      entries.forEach((value, key) => {
        obj[key] = value;
      });
      await transport.post(protocol.buildBatchSetUrl(), { entries: obj, ...backendConfig });
    },
  };
}
