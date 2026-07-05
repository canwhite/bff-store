/**
 * Remote Storage Adapter
 *
 * Client-side adapter that calls the embedded sidecar server.
 * Uses HttpTransport and RestStorageProtocol for HTTP operations.
 */

import type { Storage, StorageAdapter } from '../base';
import { HttpTransport, type TransportAdapter } from '../transport';
import { RestStorageProtocol, createStorageWithProtocol, type StorageHttpProtocol } from '../protocol';

export interface RemoteStorageOptions {
  baseUrl?: string;  // Default: 'http://localhost:3847'
  entityId?: string; // Default entityId for all requests
  transport?: TransportAdapter; // Custom transport (default: HttpTransport)
  protocol?: StorageHttpProtocol; // Custom protocol (default: RestStorageProtocol)
  // Storage backend configuration (sent to BFF)
  backend?: 'mongodb' | 'jsonl';
  mongoUrl?: string;
  mongoDb?: string;
  jsonlDir?: string;
}

/**
 * Create a remote storage adapter that connects to the embedded sidecar server.
 *
 * @example
 * ```typescript
 * import { createStore, remoteStorage } from 'bff-store';
 *
 * // Connect to default server (localhost:3847)
 * const adapter = remoteStorage();
 *
 * // Or with custom server URL
 * const adapter = remoteStorage({ baseUrl: 'http://localhost:3847' });
 *
 * // With entityId
 * const adapter = remoteStorage({ entityId: 'user-123' });
 *
 * const store = createStore('user-123', config, { storage: adapter });
 * ```
 */
export function remoteStorage(options: RemoteStorageOptions = {}): StorageAdapter {
  const baseUrl = options.baseUrl ?? 'http://localhost:3847';
  const transport = options.transport ?? new HttpTransport();
  const entityId = { current: options.entityId };

  // Backend config for BFF routing
  const backendConfig = {
    backend: options.backend,
    mongoUrl: options.mongoUrl,
    mongoDb: options.mongoDb,
    jsonlDir: options.jsonlDir,
  };

  // Pass the entityId object ref so getEntityId() reads the live value on each request
  const protocol = options.protocol ?? new RestStorageProtocol(baseUrl, entityId, backendConfig);
  const storage = createStorageWithProtocol(transport, protocol);

  const adapter: StorageAdapter = {
    storage,
    name: 'remote',
    setEntityId(id: string) {
      entityId.current = id;
    },
  };

  return adapter;
}

export { remoteStorage as createRemoteStorage };
