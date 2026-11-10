import type { Request, Response } from 'express';
import type { ProductListQueryInput } from '@shopsphere/validation';
import { sendSuccess, sendPaginated } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import * as service from './catalog.service.js';
import { listApprovedReviewsForProduct } from '../../repositories/review.repository.js';
import { recordProductView } from '../../repositories/discovery.repository.js';
import { hashGuestToken } from '../../repositories/cart.repository.js';
import { toCategoryDto, toBrandDto, toProductSummaryDto, toProductDetailDto, toQuestionDto } from './catalog.dto.js';
import { toReviewDto } from '../reviews/review.dto.js';
import { findPublishedProductBySlug } from '../../repositories/product.repository.js';

export async function listCategoriesHandler(_req: Request, res: Response): Promise<void> {
  const categories = await service.listCategories();
  sendSuccess(res, categories.map(toCategoryDto));
}

export async function listBrandsHandler(_req: Request, res: Response): Promise<void> {
  const brands = await service.listBrands();
  sendSuccess(res, brands.map(toBrandDto));
}

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ProductListQueryInput;
  const { products, totalItems, page, pageSize } = await service.listProducts(query);
  sendPaginated(res, products.map(toProductSummaryDto), { page, pageSize, totalItems });
}

export async function getProductHandler(req: Request, res: Response): Promise<void> {
  const { product, variants } = await service.getProductDetail(reqParam(req, 'slug'));

  if (req.auth?.userId) {
    await recordProductView({ userId: req.auth.userId }, product._id.toString());
  } else if (req.guestToken) {
    await recordProductView({ guestTokenHash: hashGuestToken(req.guestToken) }, product._id.toString());
  }

  sendSuccess(res, toProductDetailDto(product, variants));
}

export async function compareProductsHandler(req: Request, res: Response): Promise<void> {
  const { ids } = req.query as unknown as { ids: string[] };
  const results = await service.compareProducts(ids);
  sendSuccess(res, results.map(({ product, variants }) => toProductDetailDto(product, variants)));
}

export async function listProductReviewsHandler(req: Request, res: Response): Promise<void> {
  const product = await findPublishedProductBySlug(reqParam(req, 'slug'));
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  if (!product) {
    sendPaginated(res, [], { page, pageSize, totalItems: 0 });
    return;
  }
  const { reviews, totalItems } = await listApprovedReviewsForProduct(product._id.toString(), page, pageSize);
  sendPaginated(res, reviews.map(toReviewDto), { page, pageSize, totalItems });
}

export async function listQuestionsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const { questions, totalItems } = await service.listQuestions(reqParam(req, 'slug'), page, pageSize);
  sendPaginated(res, questions.map(toQuestionDto), { page, pageSize, totalItems });
}

export async function askQuestionHandler(req: Request, res: Response): Promise<void> {
  const question = await service.askQuestion(reqParam(req, 'slug'), req.auth!.userId, (req.body as { body: string }).body);
  sendSuccess(res, toQuestionDto(question), { status: 201 });
}

export async function answerQuestionHandler(req: Request, res: Response): Promise<void> {
  const question = await service.answerQuestion(
    reqParam(req, 'questionId'),
    req.auth!.userId,
    (req.body as { body: string }).body,
    false
  );
  sendSuccess(res, toQuestionDto(question), { status: 201 });
}
