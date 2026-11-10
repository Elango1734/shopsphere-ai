import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { moneySchema } from './shared/money.schema.js';

export const VARIANT_STATUSES = ['draft', 'active', 'inactive', 'discontinued'] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

/**
 * Product variants own SKU-level identity and pricing; `inventory.model.ts`
 * owns the SKU-level stock counters in its own collection. Splitting price
 * (here) from stock (there) keeps high-frequency stock mutations from
 * contending with far less frequent price/attribute edits on the same
 * document, and lets inventory use tight, conditional atomic updates.
 */
const productVariantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    attributes: {
      type: Map,
      of: String,
      default: () => new Map()
    },
    regularPrice: { type: moneySchema, required: true },
    salePrice: { type: moneySchema },
    status: { type: String, enum: VARIANT_STATUSES, required: true, default: 'draft' },
    weightGrams: { type: Number, min: 0 },
    barcodeGtin: { type: String, trim: true, maxlength: 32 },
    imageStorageKey: { type: String, trim: true },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

productVariantSchema.pre('validate', function (next) {
  if (this.salePrice && this.regularPrice && this.salePrice.currency !== this.regularPrice.currency) {
    this.invalidate('salePrice', 'salePrice currency must match regularPrice currency');
  }
  if (this.salePrice && this.regularPrice && this.salePrice.amountMinor > this.regularPrice.amountMinor) {
    this.invalidate('salePrice', 'salePrice must not exceed regularPrice');
  }
  next();
});

// SKU is unique per seller, not globally: two sellers may independently choose the same SKU string.
productVariantSchema.index({ sellerId: 1, sku: 1 }, { unique: true });
productVariantSchema.index({ productId: 1, status: 1 });
productVariantSchema.index({ sellerId: 1, status: 1 });

export type ProductVariantDocument = HydratedDocument<InferSchemaType<typeof productVariantSchema>>;
export const ProductVariantModel = model('ProductVariant', productVariantSchema, 'product_variants');
