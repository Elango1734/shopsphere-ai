import type { Request, Response } from 'express';
import { sendSuccess } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import { updateCustomerProfile } from '../../repositories/user.repository.js';
import { toUserDto } from '../auth/dto.js';
import { UnauthorizedError, NotFoundError } from '../../http/errors.js';
import {
  listAddressesForUser,
  createAddress,
  findOwnedAddress,
  updateOwnedAddress,
  softDeleteOwnedAddress
} from '../../repositories/address.repository.js';
import { toAddressDto } from './address.dto.js';

export async function updateMeHandler(req: Request, res: Response): Promise<void> {
  const updated = await updateCustomerProfile(req.auth!.userId, req.body);
  if (!updated) throw new UnauthorizedError();
  sendSuccess(res, toUserDto(updated));
}

export async function listAddressesHandler(req: Request, res: Response): Promise<void> {
  const addresses = await listAddressesForUser(req.auth!.userId);
  sendSuccess(res, addresses.map(toAddressDto));
}

export async function createAddressHandler(req: Request, res: Response): Promise<void> {
  const { fields, label, isDefault } = req.body as { fields: unknown; label: 'home' | 'work' | 'other'; isDefault: boolean };
  const address = await createAddress(req.auth!.userId, fields as never, { label, isDefault });
  sendSuccess(res, toAddressDto(address), { status: 201 });
}

export async function updateAddressHandler(req: Request, res: Response): Promise<void> {
  const address = await updateOwnedAddress(reqParam(req, 'addressId'), req.auth!.userId, req.body as never);
  sendSuccess(res, toAddressDto(address));
}

export async function deleteAddressHandler(req: Request, res: Response): Promise<void> {
  await softDeleteOwnedAddress(reqParam(req, 'addressId'), req.auth!.userId);
  sendSuccess(res, { deleted: true });
}

export async function getAddressHandler(req: Request, res: Response): Promise<void> {
  const address = await findOwnedAddress(reqParam(req, 'addressId'), req.auth!.userId);
  if (!address) throw new NotFoundError('Address not found');
  sendSuccess(res, toAddressDto(address));
}
