import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const MAX_ANSWERS = 20;

const answerSchema = new Schema(
  {
    answeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isSellerAnswer: { type: Boolean, default: false },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    answeredAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: true }
);

/**
 * Answers are embedded: a Q&A thread on a marketplace product page typically
 * has a handful of answers, not an unbounded conversation (contrast with
 * SupportMessage, which is its own collection because ticket threads are
 * open-ended). The size cap below is a defensive backstop to the repository's
 * own bounded-push logic.
 */
const productQuestionSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    askedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    answers: {
      type: [answerSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => arr.length <= MAX_ANSWERS,
        message: `A question may have at most ${MAX_ANSWERS} answers`
      }
    },
    isHidden: { type: Boolean, default: false }
  },
  { timestamps: true }
);

productQuestionSchema.index({ productId: 1, createdAt: -1 });
productQuestionSchema.index({ askedBy: 1, createdAt: -1 });

export type ProductQuestionDocument = HydratedDocument<InferSchemaType<typeof productQuestionSchema>>;
export const ProductQuestionModel = model('ProductQuestion', productQuestionSchema, 'product_questions');
