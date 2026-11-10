import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const PRODUCT_MODERATION_STATUSES = ['draft', 'pending_review', 'published', 'rejected', 'archived'] as const;
export type ProductModerationStatus = (typeof PRODUCT_MODERATION_STATUSES)[number];

const MAX_IMAGES = 12;
const MAX_ATTRIBUTES = 40;

const productImageSchema = new Schema(
  {
    storageKey: { type: String, required: true, trim: true },
    altText: { type: String, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0 },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 }
  },
  { _id: false }
);

const productAttributeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 300 }
  },
  { _id: false }
);

const ratingAggregateSchema = new Schema(
  {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 },
    // distribution[0] = count of 1-star reviews ... distribution[4] = count of 5-star reviews.
    distribution: { type: [Number], default: () => [0, 0, 0, 0, 0] }
  },
  { _id: false }
);

/**
 * Product is the catalog-level description. Images, attributes, and the
 * rating aggregate are embedded because each is small, bounded (validated
 * below), and always read together with the product page. Variants/SKUs and
 * inventory are intentionally NOT embedded — see productVariant.model.ts and
 * inventory.model.ts — because they are high-cardinality, updated far more
 * frequently (stock changes), and queried independently of the parent product.
 */
const productSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 10_000 },
    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => arr.length <= MAX_IMAGES,
        message: `A product may have at most ${MAX_IMAGES} images`
      }
    },
    attributes: {
      type: [productAttributeSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => arr.length <= MAX_ATTRIBUTES,
        message: `A product may have at most ${MAX_ATTRIBUTES} attributes`
      }
    },
    returnPolicyRef: { type: String, trim: true, maxlength: 80 },
    warrantyPolicyRef: { type: String, trim: true, maxlength: 80 },
    moderationStatus: {
      type: String,
      enum: PRODUCT_MODERATION_STATUSES,
      required: true,
      default: 'draft'
    },
    moderationNote: { type: String, trim: true, maxlength: 1000 },
    // Maintained exclusively by the review repository from eligible reviews; never accepted from client input.
    ratingAggregate: { type: ratingAggregateSchema, default: () => ({}) },
    minPriceMinor: { type: Number, min: 0 },
    maxPriceMinor: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, match: /^[A-Z]{3}$/ },
    hasAvailableStock: { type: Boolean, default: false },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

productSchema.index({ slug: 1 }, { unique: true });
// Common catalog filter combinations: browse by category within moderation state, sorted for pagination.
productSchema.index({ moderationStatus: 1, categoryId: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, moderationStatus: 1, createdAt: -1 });
productSchema.index({ brandId: 1, moderationStatus: 1 });
productSchema.index({ moderationStatus: 1, minPriceMinor: 1 });
productSchema.index({ moderationStatus: 1, hasAvailableStock: 1 });
productSchema.index({ name: 'text', description: 'text' }, { weights: { name: 5, description: 1 } });

export type ProductDocument = HydratedDocument<InferSchemaType<typeof productSchema>>;
export const ProductModel = model('Product', productSchema, 'products');
