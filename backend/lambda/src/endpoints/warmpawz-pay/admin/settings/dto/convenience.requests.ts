/**
 * Global WPay fee settings:
 *   GET/PUT /admin/warmpawz-pay/settings/convenience
 *   { platformFee, platformFeeGstRate, convenienceFee, convenienceGstRate, platformGstRate, burnMode }
 *
 * Stored in admin_settings category 'wpay' only (never Marketplace 'fees').
 * platformGstRate = inclusive extract from platform revenue (C − D).
 * platformFeeGstRate / convenienceGstRate = exclusive (on top of fee).
 * burnMode = vendor paid full Q; platform funds customer discount.
 */
import { z } from 'zod';

const nonNegativeNumber = z.coerce.number().min(0);

export const updateConvenienceSettingsRequestSchema = z
  .object({
    platformFee: nonNegativeNumber,
    platformFeeGstRate: nonNegativeNumber,
    convenienceFee: nonNegativeNumber,
    convenienceGstRate: nonNegativeNumber,
    platformGstRate: nonNegativeNumber,
    burnMode: z.coerce.boolean(),
  })
  .strict();

export type UpdateConvenienceSettingsRequest = z.infer<typeof updateConvenienceSettingsRequestSchema>;

export function parseUpdateConvenienceSettingsRequest(input: unknown): UpdateConvenienceSettingsRequest {
  return updateConvenienceSettingsRequestSchema.parse(input);
}
