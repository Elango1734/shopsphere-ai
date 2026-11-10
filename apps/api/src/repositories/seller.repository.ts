import { SellerModel, type SellerDocument } from '../models/seller.model.js';

export class SellerOwnershipError extends Error {
  constructor(sellerId: string) {
    super(`Seller ${sellerId} is not owned by the requesting user`);
    this.name = 'SellerOwnershipError';
  }
}

export async function findSellerOwnedByUser(sellerId: string, ownerUserId: string): Promise<SellerDocument | null> {
  return SellerModel.findOne({ _id: sellerId, ownerUserId });
}

export async function findSellerByOwnerUserId(ownerUserId: string): Promise<SellerDocument | null> {
  return SellerModel.findOne({ ownerUserId });
}

export class NoActiveSellerError extends Error {
  constructor() {
    super('No active seller account for this user');
    this.name = 'NoActiveSellerError';
  }
}

/** Every seller-scoped mutation resolves the acting seller through this, never by trusting a sellerId from the client. */
export async function requireActiveSellerForUser(ownerUserId: string): Promise<SellerDocument> {
  const seller = await findSellerByOwnerUserId(ownerUserId);
  if (!seller || seller.status !== 'active') {
    throw new NoActiveSellerError();
  }
  return seller;
}

/**
 * The seller-ownership check every seller-scoped mutation must call before
 * touching a Product/ProductVariant/Inventory/Order document — security.md
 * and api-specification.md both require this at the data layer, not just by
 * hiding UI controls ("`seller` role alone does not grant access to another
 * seller's records"). Throws rather than returning null/undefined so a
 * forgotten `await` or ignored return value cannot silently proceed.
 */
export async function assertSellerOwnership(sellerId: string, ownerUserId: string): Promise<SellerDocument> {
  const seller = await findSellerOwnedByUser(sellerId, ownerUserId);
  if (!seller) {
    throw new SellerOwnershipError(sellerId);
  }
  if (seller.status !== 'active') {
    throw new SellerOwnershipError(sellerId);
  }
  return seller;
}

export async function transitionSellerStatus(
  sellerId: string,
  to: SellerDocument['status'],
  changedBy: string,
  note?: string
): Promise<SellerDocument | null> {
  return SellerModel.findByIdAndUpdate(
    sellerId,
    {
      $set: { status: to },
      $push: { statusHistory: { status: to, changedAt: new Date(), changedBy, note } }
    },
    { new: true }
  );
}
