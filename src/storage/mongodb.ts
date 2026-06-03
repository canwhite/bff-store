import { MongoClient, Collection, Db } from 'mongodb';
import { Storage, StorageAdapter, AsyncStorageFactory } from './base';
import type { MongoStorageOptions } from '../types';

interface MongoEntry {
  key: string;
  value: unknown;
  timestamp: number;
  entityId: string;
}

interface MongoStorageAdapter extends StorageAdapter {
  client: MongoClient;
  close(): Promise<void>;
}

/**
 * MongoDB storage adapter
 * Stores data in collection: {database}.state_{entityId}
 * Each entityId gets its own collection.
 */
export async function mongodbStorage(
  options: MongoStorageOptions
): Promise<MongoStorageAdapter> {
  const {
    url,
    database = 'jotai_state_store',
  } = options;

  const client = new MongoClient(url);
  await client.connect();

  const db: Db = client.db(database);

  // Current entityId - defaults to 'default'
  let currentEntityId = 'default';

  // Get collection name for an entityId
  function getCollectionName(eId: string): string {
    return `state_${eId}`;
  }

  // Get or create collection for an entityId
  function getCollection(eId: string): Collection<MongoEntry> {
    return db.collection<MongoEntry>(getCollectionName(eId));
  }

  const storage: Storage = {
    async get<T>(key: string): Promise<T | null> {
      const collection = getCollection(currentEntityId);

      const entry = await collection.findOne(
        { key },
        { sort: { timestamp: -1 } }
      );

      return entry ? (entry.value as T) : null;
    },

    async set<T>(key: string, value: T): Promise<void> {
      const collection = getCollection(currentEntityId);

      await collection.insertOne({
        key,
        value,
        timestamp: Date.now(),
        entityId: currentEntityId,
      });
    },

    async remove(key: string): Promise<void> {
      const collection = getCollection(currentEntityId);

      await collection.deleteMany({ key });
    },

    async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
      const collection = getCollection(currentEntityId);

      const entries = await collection
        .find({ key: { $in: keys } })
        .sort({ timestamp: -1 })
        .toArray();

      const result = new Map<string, T>();
      const seen = new Set<string>();

      for (const entry of entries) {
        if (!seen.has(entry.key)) {
          result.set(entry.key, entry.value as T);
          seen.add(entry.key);
        }
      }

      return result;
    },

    async setMultiple<T>(entries: Map<string, T>): Promise<void> {
      const collection = getCollection(currentEntityId);

      const docs: MongoEntry[] = [];
      entries.forEach((value, key) => {
        docs.push({
          key,
          value,
          timestamp: Date.now(),
          entityId: currentEntityId,
        });
      });

      if (docs.length > 0) {
        await collection.insertMany(docs);
      }
    },
  };

  const adapter: MongoStorageAdapter = {
    storage,
    name: 'mongodb',
    client,
    setEntityId(id: string) {
      currentEntityId = id;
    },
    async close() {
      await client.close();
    },
  };

  return adapter;
}

export const createMongoStorage: AsyncStorageFactory<MongoStorageOptions> = mongodbStorage;
