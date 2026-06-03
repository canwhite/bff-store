/**
 * Embedded Server entry point
 * Import from 'bff-store/server' instead of 'bff-store'
 *
 * @example
 * import { startServer } from 'bff-store/server';
 */
export { startServer } from './index';
export type { ServerOptions } from './index';
export { Router } from './router';
export { EntityIdCache } from './entityIdCache';
export { createStorageHandlers } from './handlers';
