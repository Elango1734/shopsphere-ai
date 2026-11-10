import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'Password must include upper case, lower case, and a digit'
  });

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Phone must be E.164 format');

/**
 * A blank string is how every form in this codebase represents "nothing
 * typed yet" (React Hook Form needs a defined string, not `undefined`, to
 * keep an input controlled) — `.optional()` alone only treats a field as
 * absent when it is actually `undefined`, so a blank `''` would otherwise
 * still run through `.email()`/the phone regex and fail with a confusing
 * "Invalid email"/"Phone must be E.164 format" instead of the intended
 * "Either email or phone is required". This mirrors env.ts's `blankable()`
 * helper for the same reason, one level down (form fields, not env vars).
 */
function optionalFromBlank<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());
}

/**
 * Deliberately has no `role`/`roles` field — public registration can only ever
 * create a `customer` account (security.md, database-design.md). Any
 * elevation is a distinct, authorization-gated admin operation.
 */
export const registerSchema = z
  .object({
    email: optionalFromBlank(emailSchema),
    phone: optionalFromBlank(phoneSchema),
    password: passwordSchema,
    displayName: z.string().trim().min(1).max(140).optional()
  })
  .refine((v) => Boolean(v.email || v.phone), { message: 'Either email or phone is required', path: ['email'] });

export const loginSchema = z
  .object({
    email: optionalFromBlank(emailSchema),
    phone: optionalFromBlank(phoneSchema),
    password: z.string().min(1).max(200)
  })
  .refine((v) => Boolean(v.email || v.phone), { message: 'Either email or phone is required', path: ['email'] });

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(2000)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(20).max(2000),
  newPassword: passwordSchema
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(140).optional(),
  preferredCurrency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  marketingOptIn: z.boolean().optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
