import type { ProductListQueryInput } from '@shopsphere/validation';
import { CategoryModel } from '../../models/category.model.js';
import { BrandModel } from '../../models/brand.model.js';
import { ProductVariantModel } from '../../models/productVariant.model.js';
import { ProductQuestionModel, type ProductQuestionDocument } from '../../models/productQuestion.model.js';
import { listPublishedProducts, findPublishedProductBySlug, findPublishedProductsByIds } from '../../repositories/product.repository.js';
import { getAvailableQuantity } from '../../repositories/inventory.repository.js';
import { NotFoundError } from '../../http/errors.js';
import { toPublicId } from '../../utils/ids.js';

export async function listCategories() {
  return CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
}

export async function listBrands() {
  return BrandModel.find({ isActive: true }).sort({ name: 1 });
}

export async function listProducts(query: ProductListQueryInput) {
  const { products, totalItems } = await listPublishedProducts(
    {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.minPriceMinor != null ? { minPriceMinor: query.minPriceMinor } : {}),
      ...(query.maxPriceMinor != null ? { maxPriceMinor: query.maxPriceMinor } : {}),
      ...(query.q ? { searchText: query.q } : {}),
      ...(query.inStockOnly != null ? { inStockOnly: query.inStockOnly } : {})
    },
    query.page,
    query.pageSize,
    buildSort(query.sort, query.order)
  );
  return { products, totalItems, page: query.page, pageSize: query.pageSize };
}

function buildSort(sort: string | undefined, order: 'asc' | 'desc'): Record<string, 1 | -1> {
  const direction = order === 'asc' ? 1 : -1;
  const allowed = new Set(['createdAt', 'minPriceMinor', 'name']);
  const field = sort && allowed.has(sort) ? sort : 'createdAt';
  return { [field]: direction };
}

export async function getProductDetail(slug: string) {
  const product = await findPublishedProductBySlug(slug);
  if (!product) throw new NotFoundError('Product not found');

  const variants = await ProductVariantModel.find({
    productId: product._id,
    status: 'active',
    deletedAt: { $exists: false }
  });

  const withAvailability = await Promise.all(
    variants.map(async (variant) => ({ variant, availableQuantity: await getAvailableQuantity(variant._id.toString()) }))
  );

  return { product, variants: withAvailability };
}

export async function compareProducts(ids: string[]) {
  const products = await findPublishedProductsByIds(ids);
  const productIds = products.map((p) => p._id);

  const variants = await ProductVariantModel.find({
    productId: { $in: productIds },
    status: 'active',
    deletedAt: { $exists: false }
  });

  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const key = variant.productId.toString();
    variantsByProduct.set(key, [...(variantsByProduct.get(key) ?? []), variant]);
  }

  return Promise.all(
    products.map(async (product) => {
      const productVariants = variantsByProduct.get(product._id.toString()) ?? [];
      const withAvailability = await Promise.all(
        productVariants.map(async (variant) => ({
          variant,
          availableQuantity: await getAvailableQuantity(variant._id.toString())
        }))
      );
      return { product, variants: withAvailability };
    })
  );
}

export async function listQuestions(productSlug: string, page: number, pageSize: number) {
  const product = await findPublishedProductBySlug(productSlug);
  if (!product) throw new NotFoundError('Product not found');

  const skip = (page - 1) * pageSize;
  const [questions, totalItems] = await Promise.all([
    ProductQuestionModel.find({ productId: product._id, isHidden: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    ProductQuestionModel.countDocuments({ productId: product._id, isHidden: false })
  ]);
  return { questions, totalItems, productId: toPublicId(product._id) };
}

export async function askQuestion(productSlug: string, askedBy: string, body: string): Promise<ProductQuestionDocument> {
  const product = await findPublishedProductBySlug(productSlug);
  if (!product) throw new NotFoundError('Product not found');
  return ProductQuestionModel.create({ productId: product._id, askedBy, body });
}

export async function answerQuestion(
  questionId: string,
  answeredBy: string,
  body: string,
  isSellerAnswer: boolean
): Promise<ProductQuestionDocument> {
  const question = await ProductQuestionModel.findByIdAndUpdate(
    questionId,
    { $push: { answers: { answeredBy, body, isSellerAnswer, answeredAt: new Date() } } },
    { new: true }
  );
  if (!question) throw new NotFoundError('Question not found');
  return question;
}
