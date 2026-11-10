import { Schema } from 'mongoose';
import type { Address } from '@shopsphere/shared-types';

/**
 * Embedded address shape shared by the `addresses` collection's own fields and
 * by order-time address snapshots. Snapshots intentionally duplicate this data
 * (see database-design.md) because an order must keep rendering the address as
 * it was at purchase time even if the customer later edits or deletes the
 * source address record.
 */
export const addressFieldsSchema = new Schema<Address>(
  {
    recipientName: { type: String, required: true, trim: true, maxlength: 140 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200 },
    locality: { type: String, required: true, trim: true, maxlength: 120 },
    region: { type: String, trim: true, maxlength: 120 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    countryCode: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{2}$/ },
    phone: { type: String, trim: true, maxlength: 32 }
  },
  { _id: false }
);
