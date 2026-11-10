import { AddressModel, type AddressDocument } from '../models/address.model.js';

export class AddressOwnershipError extends Error {
  constructor(addressId: string) {
    super(`Address ${addressId} is not owned by the requesting user`);
    this.name = 'AddressOwnershipError';
  }
}

export async function listAddressesForUser(userId: string): Promise<AddressDocument[]> {
  return AddressModel.find({ ownerUserId: userId, deletedAt: { $exists: false } }).sort({ isDefault: -1, createdAt: -1 });
}

/**
 * Every address read/write in the system must go through an ownership-scoped
 * query like this one — never `findById` alone — per security.md
 * ("Enforce... customer ownership for addresses"). Returns null rather than
 * throwing so the caller can map it to a uniform 404 (not 403), avoiding
 * confirming to an attacker that the address ID exists at all.
 */
export async function findOwnedAddress(addressId: string, userId: string): Promise<AddressDocument | null> {
  return AddressModel.findOne({ _id: addressId, ownerUserId: userId, deletedAt: { $exists: false } });
}

export async function createAddress(
  userId: string,
  fields: AddressDocument['fields'],
  options: { label?: string; isDefault?: boolean } = {}
): Promise<AddressDocument> {
  if (options.isDefault) {
    await AddressModel.updateMany({ ownerUserId: userId }, { $set: { isDefault: false } });
  }
  return AddressModel.create({
    ownerUserId: userId,
    fields,
    label: options.label ?? 'home',
    isDefault: options.isDefault ?? false
  });
}

export async function updateOwnedAddress(
  addressId: string,
  userId: string,
  update: Partial<Pick<AddressDocument, 'fields' | 'label' | 'isDefault'>>
): Promise<AddressDocument> {
  const address = await findOwnedAddress(addressId, userId);
  if (!address) throw new AddressOwnershipError(addressId);

  if (update.isDefault) {
    await AddressModel.updateMany({ ownerUserId: userId }, { $set: { isDefault: false } });
  }
  Object.assign(address, update);
  await address.save();
  return address;
}

/** Soft delete only: an address may already be referenced for support/audit purposes even though orders snapshot their own copy. */
export async function softDeleteOwnedAddress(addressId: string, userId: string): Promise<void> {
  const address = await findOwnedAddress(addressId, userId);
  if (!address) throw new AddressOwnershipError(addressId);
  address.deletedAt = new Date();
  await address.save();
}
