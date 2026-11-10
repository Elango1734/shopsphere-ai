import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import {
  createAddress,
  findOwnedAddress,
  updateOwnedAddress,
  softDeleteOwnedAddress,
  AddressOwnershipError
} from '../../src/repositories/address.repository.js';
import { SellerModel } from '../../src/models/seller.model.js';
import { assertSellerOwnership, SellerOwnershipError } from '../../src/repositories/seller.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

const sampleFields = {
  recipientName: 'Jane Doe',
  addressLine1: '1 Infinite Loop',
  locality: 'Cupertino',
  postalCode: '95014',
  countryCode: 'US'
};

describe('Address ownership boundary (security.md: customer ownership)', () => {
  it('a user cannot read another user\'s address by ID', async () => {
    const ownerId = new Types.ObjectId().toString();
    const attackerId = new Types.ObjectId().toString();

    const address = await createAddress(ownerId, sampleFields);

    await expect(findOwnedAddress(address._id.toString(), attackerId)).resolves.toBeNull();
    await expect(findOwnedAddress(address._id.toString(), ownerId)).resolves.not.toBeNull();
  });

  it('a user cannot update another user\'s address', async () => {
    const ownerId = new Types.ObjectId().toString();
    const attackerId = new Types.ObjectId().toString();
    const address = await createAddress(ownerId, sampleFields);

    await expect(
      updateOwnedAddress(address._id.toString(), attackerId, { fields: { ...sampleFields, locality: 'Hacked' } })
    ).rejects.toThrow(AddressOwnershipError);
  });

  it('a user cannot delete another user\'s address', async () => {
    const ownerId = new Types.ObjectId().toString();
    const attackerId = new Types.ObjectId().toString();
    const address = await createAddress(ownerId, sampleFields);

    await expect(softDeleteOwnedAddress(address._id.toString(), attackerId)).rejects.toThrow(AddressOwnershipError);
  });

  it('a soft-deleted address is excluded from ownership lookups', async () => {
    const ownerId = new Types.ObjectId().toString();
    const address = await createAddress(ownerId, sampleFields);
    await softDeleteOwnedAddress(address._id.toString(), ownerId);

    await expect(findOwnedAddress(address._id.toString(), ownerId)).resolves.toBeNull();
  });
});

describe('Seller ownership boundary (api-specification.md: seller role alone does not grant cross-seller access)', () => {
  it('rejects a seller acting on a store they do not own', async () => {
    const ownerUserId = new Types.ObjectId().toString();
    const otherUserId = new Types.ObjectId().toString();

    const seller = await SellerModel.create({
      ownerUserId,
      storeName: 'Owned Store',
      slug: 'owned-store',
      status: 'active'
    });

    await expect(assertSellerOwnership(seller._id.toString(), ownerUserId)).resolves.toBeDefined();
    await expect(assertSellerOwnership(seller._id.toString(), otherUserId)).rejects.toThrow(SellerOwnershipError);
  });

  it('rejects ownership assertion for a suspended seller even for the true owner', async () => {
    const ownerUserId = new Types.ObjectId().toString();
    const seller = await SellerModel.create({
      ownerUserId,
      storeName: 'Suspended Store',
      slug: 'suspended-store',
      status: 'suspended'
    });

    await expect(assertSellerOwnership(seller._id.toString(), ownerUserId)).rejects.toThrow(SellerOwnershipError);
  });
});
