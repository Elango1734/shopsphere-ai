import { z } from 'zod';

export const addressFieldsInputSchema = z.object({
  recipientName: z.string().trim().min(1).max(140),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  locality: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1).max(20),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase()),
  phone: z.string().trim().max(32).optional()
});

export const createAddressSchema = z.object({
  fields: addressFieldsInputSchema,
  label: z.enum(['home', 'work', 'other']).default('home'),
  isDefault: z.boolean().default(false)
});

export const updateAddressSchema = z.object({
  fields: addressFieldsInputSchema.partial().optional(),
  label: z.enum(['home', 'work', 'other']).optional(),
  isDefault: z.boolean().optional()
});

export type AddressFieldsInput = z.infer<typeof addressFieldsInputSchema>;
