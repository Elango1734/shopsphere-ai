import type { AddressDocument } from '../../models/address.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toAddressDto(address: AddressDocument) {
  return {
    id: toPublicId(address._id),
    label: address.label,
    isDefault: address.isDefault,
    fields: address.fields,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString()
  };
}
