import { Types } from 'mongoose';

/** Opaque public ID mapping: internal ObjectId is never serialized to a client directly. */
export function toPublicId(id: Types.ObjectId | string): string {
  return id.toString();
}

export function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
