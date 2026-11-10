import mongoose, { type ClientSession } from 'mongoose';

/**
 * Runs `work` inside a MongoDB session transaction with automatic retry on
 * transient transaction errors (the pattern MongoDB documents for replica-set
 * transactions under contention, e.g. concurrent inventory reservations).
 *
 * Callers must only perform MongoDB operations inside `work` — never an
 * external network call (payment provider, AI provider, etc.). Architecture
 * requires those to happen outside the transaction using explicit pending
 * states and idempotent follow-up, since a DB transaction cannot roll back an
 * external side effect.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: 10_000
      }
    );
    // `withTransaction` only resolves after a successful commit, so `result!` is always assigned here.
    return result!;
  } finally {
    await session.endSession();
  }
}
