/**
 * Abhi contract — Bindu WPay publish backend:
 *   GET /admin/payments/tiers → marketplaceEnabled, warmpawzPayEnabled
 *   GET /admin/payments/tiers?warmpawzPayEnabled=true&isActive=true → WPay dropdown
 *   POST/PUT /admin/payments/tiers → persist those flags (Both = true/true)
 *   POST/PUT /admin/warmpawz-pay/pricing
 *     { vendorId, tierId, discountValue, discountType?, status?, effectiveFrom, effectiveUntil? }
 *     → { tierId, tierName, commissionRate, discountValue, platformMargin, platformWithholdPercent? }
 *   GET catalogue / pricing → same inherited tier fields
 *   GET/PUT /admin/warmpawz-pay/settings/convenience
 *     { convenienceFee, convenienceGstRate, platformGstRate }
 *
 * platformWithholdPercent is rejected on new writes (strict schema).
 * Commission is inherited server-side from vendor_tiers.commission_rate.
 */
import { z } from 'zod';
import { uuidSchema } from '../../../../../middleware/validation-middleware';
import {
  ALLOWED_PRICING_DISCOUNT_TYPES,
  ALLOWED_PRICING_STATUSES,
  PRICING_DISCOUNT_TYPE,
  PRICING_STATUS,
} from '../../../constants/merchant-pricing';

const isoDateSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be a valid ISO 8601 datetime' });

export const createPricingRequestSchema = z
  .object({
    vendorId: uuidSchema,
    tierId: uuidSchema,
    discountType: z.enum(ALLOWED_PRICING_DISCOUNT_TYPES).default(PRICING_DISCOUNT_TYPE.PERCENTAGE),
    discountValue: z.coerce.number().min(0).max(100),
    status: z.enum(ALLOWED_PRICING_STATUSES).default(PRICING_STATUS.ACTIVE),
    effectiveFrom: isoDateSchema,
    effectiveUntil: isoDateSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveUntil) {
      const from = new Date(value.effectiveFrom);
      const until = new Date(value.effectiveUntil);
      if (until.getTime() < from.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effective until must be on or after effective from',
          path: ['effectiveUntil'],
        });
      }
    }
  });

export type CreatePricingRequest = z.infer<typeof createPricingRequestSchema>;

export const updatePricingRequestSchema = z
  .object({
    tierId: uuidSchema.optional(),
    discountType: z.enum(ALLOWED_PRICING_DISCOUNT_TYPES).optional(),
    discountValue: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(ALLOWED_PRICING_STATUSES).optional(),
    effectiveFrom: isoDateSchema.optional(),
    effectiveUntil: isoDateSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveFrom && value.effectiveUntil) {
      const from = new Date(value.effectiveFrom);
      const until = new Date(value.effectiveUntil);
      if (until.getTime() < from.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effective until must be on or after effective from',
          path: ['effectiveUntil'],
        });
      }
    }
  });

export type UpdatePricingRequest = z.infer<typeof updatePricingRequestSchema>;

export function parseCreatePricingRequest(input: unknown): CreatePricingRequest {
  return createPricingRequestSchema.parse(input);
}

export function parseUpdatePricingRequest(input: unknown): UpdatePricingRequest {
  return updatePricingRequestSchema.parse(input);
}
