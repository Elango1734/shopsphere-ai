import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { addressFieldsSchema } from './shared/address.schema.js';

export const ADDRESS_LABELS = ['home', 'work', 'other'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

/**
 * Addresses are a separate collection (not embedded in User) because they are
 * independently created/edited/deleted, can grow to a handful-to-dozens per
 * customer, and must be ownership-checked on every read/write by the service
 * layer independent of loading the whole user document.
 */
const addressSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, enum: ADDRESS_LABELS, default: 'home' },
    fields: { type: addressFieldsSchema, required: true },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

addressSchema.index({ ownerUserId: 1, deletedAt: 1, createdAt: -1 });
addressSchema.index({ ownerUserId: 1, isDefault: 1 });

export type AddressDocument = HydratedDocument<InferSchemaType<typeof addressSchema>>;
export const AddressModel = model('Address', addressSchema, 'addresses');
