/**
 * MongoDB storage adapter entry point
 * Import from 'bff-store/mongodb' instead of 'bff-store'
 *
 * @example
 * import { mongodbStorage } from 'bff-store/mongodb';
 */
export { mongodbStorage, createMongoStorage } from './mongodb';
export type { MongoStorageOptions } from '../types';
