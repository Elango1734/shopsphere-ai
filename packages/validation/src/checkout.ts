import { z } from 'zod';
import { objectIdSchema } from './common.js';
import { addressFieldsInputSchema } from './address.js';

export const checkoutInputSchema = z.object({
  shippingAddressId: objectIdSchema.optional(),
  shippingAddress: addressFieldsInputSchema.optional(),
  couponCode: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(['development_card']).default('development_card'),
  /** Development-provider-only testing hook; a real provider adapter has no such field. */
  simulate: z.enum(['success', 'failure']).default('success')
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
