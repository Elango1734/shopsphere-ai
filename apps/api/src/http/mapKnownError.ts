import { ZodError } from 'zod';
import { AppError, ValidationError, ConflictError, ForbiddenError, UnprocessableError, UnauthorizedError } from './errors.js';
import { AddressOwnershipError } from '../repositories/address.repository.js';
import { SellerOwnershipError, NoActiveSellerError } from '../repositories/seller.repository.js';
import { InsufficientStockError, ReservationNotActiveError } from '../repositories/inventory.repository.js';
import { DuplicateCheckoutError, InvalidStatusTransitionError } from '../repositories/order.repository.js';
import { IdempotencyConflictError } from '../repositories/idempotency.repository.js';
import { CouponNotEligibleError } from '../repositories/coupon.repository.js';
import { ReviewEligibilityError } from '../repositories/review.repository.js';
import { RefundExceedsCapturedAmountError } from '../repositories/refund.repository.js';
import { RefreshTokenReuseError, RefreshTokenInvalidError } from '../repositories/refreshSession.repository.js';
import { CurrencyMismatchError } from '../utils/money.js';

/**
 * Translates domain/repository errors (which intentionally know nothing
 * about HTTP) into the API's stable error codes, so every module's
 * controllers can just `throw` the repository error and let the central
 * error handler (http/middleware/errorHandler.ts) apply this mapping once.
 * Returns null for anything it doesn't recognize, so the caller falls back
 * to a generic 500 rather than ever guessing at a client-facing message.
 */
export function mapKnownError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new ValidationError(
      error.issues.map((issue) => ({ code: 'INVALID_FORMAT', message: issue.message, field: issue.path.join('.') }))
    );
  }

  if (error instanceof AddressOwnershipError || error instanceof SellerOwnershipError || error instanceof NoActiveSellerError) {
    return new ForbiddenError(error.message);
  }

  if (error instanceof InsufficientStockError) {
    return new ConflictError('INSUFFICIENT_STOCK', error.message);
  }

  if (error instanceof ReservationNotActiveError) {
    return new ConflictError('RESERVATION_NOT_ACTIVE', error.message);
  }

  if (error instanceof DuplicateCheckoutError) {
    return new ConflictError('IDEMPOTENCY_CONFLICT', error.message);
  }

  if (error instanceof InvalidStatusTransitionError) {
    return new ConflictError('INVALID_STATUS_TRANSITION', error.message);
  }

  if (error instanceof IdempotencyConflictError) {
    return new ConflictError('IDEMPOTENCY_CONFLICT', error.message);
  }

  if (error instanceof CouponNotEligibleError) {
    return new UnprocessableError('COUPON_NOT_ELIGIBLE', error.message);
  }

  if (error instanceof ReviewEligibilityError) {
    return new UnprocessableError('REVIEW_NOT_ELIGIBLE', error.message);
  }

  if (error instanceof RefundExceedsCapturedAmountError) {
    return new UnprocessableError('REFUND_EXCEEDS_CAPTURED_AMOUNT', error.message);
  }

  if (error instanceof RefreshTokenReuseError || error instanceof RefreshTokenInvalidError) {
    return new UnauthorizedError(error.message);
  }

  if (error instanceof CurrencyMismatchError) {
    return new UnprocessableError('CURRENCY_MISMATCH', error.message);
  }

  if (isMongoDuplicateKeyError(error)) {
    return new ConflictError('DUPLICATE_RESOURCE', 'A resource with the same unique value already exists');
  }

  if (isMongooseValidationError(error)) {
    const details = Object.entries(error.errors).map(([field, err]) => ({
      code: 'INVALID_FORMAT',
      message: (err as { message: string }).message,
      field
    }));
    return new ValidationError(details);
  }

  return null;
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000);
}

function isMongooseValidationError(error: unknown): error is { errors: Record<string, unknown> } {
  return Boolean(
    error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'ValidationError' && 'errors' in error
  );
}
