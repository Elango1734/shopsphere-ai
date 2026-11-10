import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    description: { type: String, trim: true, maxlength: 1000 },
    iconStorageKey: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, isActive: 1, sortOrder: 1 });

export type CategoryDocument = HydratedDocument<InferSchemaType<typeof categorySchema>>;
export const CategoryModel = model('Category', categorySchema, 'categories');
