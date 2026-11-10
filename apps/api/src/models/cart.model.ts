import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { moneySchema } from './shared/money.schema.js';

const MAX_CART_LINES = 100;

const cartItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    quantity: { type: Number, required: true, min: 1, max: 999 },
    // Indicative only — checkout always re-reads current ProductVariant price. Never trusted as authoritative.
    indicativeUnitPrice: { type: moneySchema, required: true },
    addedAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: false }
);

/**
 * A guest cart is identified by the SHA-256 hash of an opaque guest token
 * (never the raw token, and never anything derived from a customer identity)
 * so a leaked/guessed hash cannot be reversed into a usable guest session and
 * cannot collide with how authenticated carts are looked up. Exactly one of
 * `ownerUserId` / `guestTokenHash` is set; see the pre-validate guard below.
 */
const cartSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestTokenHash: { type: String, trim: true },
    items: {
      type: [cartItemSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => arr.length <= MAX_CART_LINES,
        message: `A cart may have at most ${MAX_CART_LINES} distinct lines`
      }
    },
    currency: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/, default: 'USD' },
    // Guest carts expire; authenticated carts persist indefinitely (no field set means "does not expire").
    expiresAt: { type: Date },
    mergedIntoUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

cartSchema.pre('validate', function (next) {
  const hasOwner = Boolean(this.ownerUserId);
  const hasGuestToken = Boolean(this.guestTokenHash);
  if (hasOwner === hasGuestToken) {
    this.invalidate('ownerUserId', 'A cart must have exactly one of ownerUserId or guestTokenHash');
  }
  next();
});

cartSchema.index({ ownerUserId: 1 }, { unique: true, sparse: true });
cartSchema.index({ guestTokenHash: 1 }, { unique: true, sparse: true });
// Guest carts only; authenticated carts never set expiresAt and are therefore ignored by this TTL index.
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CartDocument = HydratedDocument<InferSchemaType<typeof cartSchema>>;
export const CartModel = model('Cart', cartSchema, 'carts');
