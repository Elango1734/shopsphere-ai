import mongoose from 'mongoose';
import { getEnv } from '../config/env.js';

export interface ConnectOptions {
  /** Throw if the connected deployment is not running as a replica set (required for transactions). */
  requireReplicaSet?: boolean;
  uri?: string;
}

let connectPromise: Promise<typeof mongoose> | null = null;

/**
 * Connects the shared Mongoose default connection. Idempotent: concurrent callers
 * await the same in-flight connection instead of racing multiple connects.
 */
export async function connectToDatabase(options: ConnectOptions = {}): Promise<typeof mongoose> {
  const { requireReplicaSet = true, uri } = options;

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectPromise) {
    const env = getEnv();
    const connectionUri = uri ?? env.MONGODB_URI;

    connectPromise = mongoose
      .connect(connectionUri, {
        ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20
      })
      .then(async (conn) => {
        if (requireReplicaSet) {
          await assertReplicaSet(conn);
        }
        return conn;
      })
      .catch((error) => {
        connectPromise = null;
        throw error;
      });
  }

  return connectPromise;
}

/**
 * Checkout, inventory reservation, and order creation require multi-document
 * transactions, which MongoDB only supports against a replica set (or sharded
 * cluster) deployment, never a standalone mongod. Fail fast with a clear error
 * rather than letting transaction calls fail obscurely later.
 */
async function assertReplicaSet(conn: typeof mongoose): Promise<void> {
  const admin = conn.connection.db?.admin();
  if (!admin) {
    throw new Error('Unable to access admin database to verify replica set status');
  }
  try {
    await admin.command({ replSetGetStatus: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `MongoDB connection is not a replica set (required for transactions). Start mongod with --replSet and run rs.initiate(), ` +
        `or point MONGODB_URI at a replica-set deployment. Original error: ${message}`
    );
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  connectPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function registerGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    try {
      await disconnectFromDatabase();
    } finally {
      process.exit(signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}
