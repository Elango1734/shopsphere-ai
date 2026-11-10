import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    logoStorageKey: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

brandSchema.index({ slug: 1 }, { unique: true });
brandSchema.index({ isActive: 1, name: 1 });

export type BrandDocument = HydratedDocument<InferSchemaType<typeof brandSchema>>;
export const BrandModel = model('Brand', brandSchema, 'brands');
