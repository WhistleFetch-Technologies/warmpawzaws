/**
 * Global WPay fee settings:
 *   GET/PUT /admin/warmpawz-pay/settings/convenience
 *
 * Stored in admin_settings category 'wpay' only (never Marketplace 'fees').
 * platformGstRate = inclusive extract from platform revenue (C − D).
 * platformFeeGstRate = exclusive (on top of fee).
 * platformFeeMode: fixed ₹ or percent of post-discount amount.
 * burnMode = vendor paid full Q; platform funds customer discount.
 *
 * Convenience fee is retired on Pay Bill: legacy convenience* fields are accepted
 * (older admin clients) but the service always persists them as 0.
 */
import { z } from 'zod';

const nonNegativeNumber = z.coerce.number().min(0);
const feeModeSchema = z.enum(['fixed', 'percent']);

export const updateConvenienceSettingsRequestSchema = z
  .object({
    platformFee: nonNegativeNumber,
    platformFeeMode: feeModeSchema,
    platformFeeGstRate: nonNegativeNumber,
    convenienceFee: nonNegativeNumber.optional(),
    convenienceFeeMode: feeModeSchema.optional(),
    convenienceGstRate: nonNegativeNumber.optional(),
    platformGstRate: nonNegativeNumber,
    burnMode: z.coerce.boolean(),
  })
  .strict();

export type UpdateConvenienceSettingsRequest = z.infer<typeof updateConvenienceSettingsRequestSchema>;

export function parseUpdateConvenienceSettingsRequest(input: unknown): UpdateConvenienceSettingsRequest {
  return updateConvenienceSettingsRequestSchema.parse(input);
}
