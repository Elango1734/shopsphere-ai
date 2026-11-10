import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
  IdempotencyConflictError
} from '../../src/repositories/idempotency.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('Idempotency-Key semantics (api-specification.md)', () => {
  it('a first call returns "new"', async () => {
    const principalId = new Types.ObjectId().toString();
    const outcome = await beginIdempotentOperation(principalId, 'checkout', 'key-1', { total: 100 });
    expect(outcome.kind).toBe('new');
  });

  it('a retry with the same request payload returns "replay" with the stored response', async () => {
    const principalId = new Types.ObjectId().toString();
    const first = await beginIdempotentOperation(principalId, 'checkout', 'key-2', { total: 100 });
    await completeIdempotentOperation(first.record._id.toString(), { orderId: 'order-123' });

    const second = await beginIdempotentOperation(principalId, 'checkout', 'key-2', { total: 100 });
    expect(second.kind).toBe('replay');
    expect(second.record.responseSnapshot).toEqual({ orderId: 'order-123' });
  });

  it('a retry with a different request payload throws IdempotencyConflictError (-> 409)', async () => {
    const principalId = new Types.ObjectId().toString();
    await beginIdempotentOperation(principalId, 'checkout', 'key-3', { total: 100 });

    await expect(beginIdempotentOperation(principalId, 'checkout', 'key-3', { total: 999 })).rejects.toThrow(
      IdempotencyConflictError
    );
  });

  it('scopes keys independently per principal and per operation scope', async () => {
    const principalA = new Types.ObjectId().toString();
    const principalB = new Types.ObjectId().toString();

    const a = await beginIdempotentOperation(principalA, 'checkout', 'shared-key', { total: 1 });
    const b = await beginIdempotentOperation(principalB, 'checkout', 'shared-key', { total: 1 });
    const c = await beginIdempotentOperation(principalA, 'refund', 'shared-key', { total: 1 });

    expect(a.kind).toBe('new');
    expect(b.kind).toBe('new');
    expect(c.kind).toBe('new');
  });

  it('concurrent first-time calls for the same key race safely to a single "new" outcome', async () => {
    const principalId = new Types.ObjectId().toString();
    const attempt = () => beginIdempotentOperation(principalId, 'checkout', 'race-key', { total: 42 });

    const results = await Promise.all([attempt(), attempt(), attempt()]);
    expect(results.filter((r) => r.kind === 'new').length).toBe(1);
    expect(results.filter((r) => r.kind === 'replay').length).toBe(2);
  });
});
