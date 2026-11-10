import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet: MongoMemoryReplSet | undefined;

/**
 * Integration tests run against a real single-node MongoDB replica set
 * (in-memory, downloaded/cached by mongodb-memory-server) rather than a
 * standalone instance, because transactions — the mechanism this project
 * relies on for checkout/inventory/refund correctness — only work against a
 * replica set. testing.md requires transactions to be "exercised, not mocked
 * away"; a standalone mongod would silently make that impossible.
 */
export async function startMemoryReplicaSet(): Promise<string> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  // `mongoose.connect()` resolving does not mean every already-registered model's indexes (built via
  // autoIndex, asynchronously, in the background) have finished. A test that immediately relies on a unique
  // index — e.g. a duplicate-email rejection — can otherwise race ahead of index creation and wrongly
  // observe no conflict, especially under the system load of a full multi-suite run. `Model.init()` resolves
  // once that model's indexes are actually built, so waiting for every registered model here closes the race.
  await Promise.all(Object.values(mongoose.connection.models).map((model) => model.init()));

  return uri;
}

export async function stopMemoryReplicaSet(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = undefined;
}

export async function clearAllCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}
