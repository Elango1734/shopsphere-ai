import { Schema } from 'mongoose';
import type { Money } from '@shopsphere/shared-types';

/**
 * Money is always an integer minor-unit amount plus an explicit ISO 4217 code.
 * Never store floating-point currency values anywhere in the schema tree.
 */
export const moneySchema = new Schema<Money>(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'amountMinor must be an integer minor-unit value'
      }
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/
    }
  },
  { _id: false }
);

/** Signed variant for fields that may legitimately be negative (e.g. a discount delta applied to a running total). */
export const signedMoneySchema = new Schema<Money>(
  {
    amountMinor: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'amountMinor must be an integer minor-unit value'
      }
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/
    }
  },
  { _id: false }
);
