/**
 * Global WPay fee settings:
 *   GET/PUT /admin/warmpawz-pay/settings/convenience
 *
 * Stored in admin_settings category 'wpay' only (never Marketplace 'fees').
 * platformGstRate = inclusive extract from platform revenue (C − D).
 * platformFeeGstRate / convenienceGstRate = exclusive (on top of fee).
 * platformFeeMode / convenienceFeeMode: fixed ₹ or percent of post-discount amount.
 * burnMode = vendor paid full Q; platform funds customer discount.
 */
import { z } from 'zod';

const nonNegativeNumber = z.coerce.number().min(0);
const feeModeSchema = z.enum(['fixed', 'percent']);

export const updateConvenienceSettingsRequestSchema = z
  .object({
    platformFee: nonNegativeNumber,
    platformFeeMode: feeModeSchema,
    platformFeeGstRate: nonNegativeNumber,
    convenienceFee: nonNegativeNumber,
    convenienceFeeMode: feeModeSchema,
    convenienceGstRate: nonNegativeNumber,
    platformGstRate: nonNegativeNumber,
    burnMode: z.coerce.boolean(),
  })
  .strict();

export type UpdateConvenienceSettingsRequest = z.infer<typeof updateConvenienceSettingsRequestSchema>;

export function parseUpdateConvenienceSettingsRequest(input: unknown): UpdateConvenienceSettingsRequest {
  return updateConvenienceSettingsRequestSchema.parse(input);
}
