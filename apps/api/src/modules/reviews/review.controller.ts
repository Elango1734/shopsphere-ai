import type { Request, Response } from 'express';
import type { CreateReviewInput } from '@shopsphere/validation';
import { sendSuccess } from '../../http/envelope.js';
import { createVerifiedReview } from '../../repositories/review.repository.js';
import { ProductVariantModel } from '../../models/productVariant.model.js';
import { NotFoundError } from '../../http/errors.js';
import { toReviewDto } from './review.dto.js';

async function resolveProductIdForVariant(variantId: string): Promise<string> {
  const variant = await ProductVariantModel.findById(variantId).select('productId');
  if (!variant) throw new NotFoundError('Variant not found');
  return variant.productId.toString();
}

export async function createReviewHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateReviewInput;
  const productId = await resolveProductIdForVariant(input.orderItemVariantId);

  const review = await createVerifiedReview({
    productId,
    customerId: req.auth!.userId,
    orderId: input.orderId,
    orderItemVariantId: input.orderItemVariantId,
    rating: input.rating,
    ...(input.title ? { title: input.title } : {}),
    ...(input.body ? { body: input.body } : {})
  });
  sendSuccess(res, toReviewDto(review), { status: 201 });
}
