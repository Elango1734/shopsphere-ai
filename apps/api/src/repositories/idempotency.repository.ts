import { createHash } from 'node:crypto';
import { IdempotencyRecordModel, type IdempotencyRecordDocument } from '../models/idempotencyRecord.model.js';

export class IdempotencyConflictError extends Error {
  constructor(scope: string, key: string) {
    super(`Idempotency key reused with different input for scope=${scope} key=${key}`);
    this.name = 'IdempotencyConflictError';
  }
}

export function hashRequestPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export type IdempotencyOutcome =
  | { kind: 'new'; record: IdempotencyRecordDocument }
  | { kind: 'replay'; record: IdempotencyRecordDocument };

/**
 * Implements the API contract's Idempotency-Key semantics: a first call for
 * (principalId, scope, key) creates a `pending` record and returns `new` so
 * the caller proceeds with the operation; a retried call with the *same*
 * request hash returns `replay` with the previously stored response so the
 * caller can return it without re-executing side effects; a retried call
 * with a *different* request hash throws IdempotencyConflictError, which the
 * HTTP layer (Prompt 3) maps to 409 IDEMPOTENCY_CONFLICT. The unique
 * (principalId, scope, key) index makes the "create if absent" step itself
 * race-safe under concurrent duplicate submissions.
 */
export async function beginIdempotentOperation(
  principalId: string,
  scope: string,
  key: string,
  requestPayload: unknown
): Promise<IdempotencyOutcome> {
  const requestHash = hashRequestPayload(requestPayload);

  try {
    const record = await IdempotencyRecordModel.create({ principalId, scope, key, requestHash, status: 'pending' });
    return { kind: 'new', record };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  const existing = await IdempotencyRecordModel.findOne({ principalId, scope, key });
  if (!existing) {
    // Lost a race reading back a just-inserted record; treat as a transient retry case for the caller.
    throw new Error('Idempotency record vanished after duplicate-key race; retry the request');
  }
  if (existing.requestHash !== requestHash) {
    throw new IdempotencyConflictError(scope, key);
  }
  return { kind: 'replay', record: existing };
}

export async function completeIdempotentOperation(
  recordId: string,
  responseSnapshot: unknown,
  resultResourceId?: string
): Promise<void> {
  await IdempotencyRecordModel.updateOne(
    { _id: recordId },
    { $set: { status: 'completed', responseSnapshot, resultResourceId } }
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000);
}
