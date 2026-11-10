import type { ApiClient } from '../core.js';
import type { AddressDto, AddressFields, UserDto } from '../types.js';

export interface UpdateProfilePayload {
  displayName?: string;
  preferredCurrency?: string;
  marketingOptIn?: boolean;
}

export interface CreateAddressPayload {
  fields: AddressFields;
  label?: 'home' | 'work' | 'other';
  isDefault?: boolean;
}

export function createProfileModule(client: ApiClient) {
  return {
    updateMe: (payload: UpdateProfilePayload) => client.request<UserDto>('PATCH', '/me', payload),
    listAddresses: () => client.request<AddressDto[]>('GET', '/me/addresses'),
    getAddress: (addressId: string) => client.request<AddressDto>('GET', `/me/addresses/${addressId}`),
    createAddress: (payload: CreateAddressPayload) => client.request<AddressDto>('POST', '/me/addresses', payload),
    updateAddress: (addressId: string, payload: Partial<CreateAddressPayload>) =>
      client.request<AddressDto>('PATCH', `/me/addresses/${addressId}`, payload),
    deleteAddress: (addressId: string) => client.request<{ deleted: boolean }>('DELETE', `/me/addresses/${addressId}`)
  };
}
