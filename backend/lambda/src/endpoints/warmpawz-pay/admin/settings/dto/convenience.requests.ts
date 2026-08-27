/**
 * Abhi contract — global WPay convenience settings:
 *   GET/PUT /admin/warmpawz-pay/settings/convenience
 *   { convenienceFee, convenienceGstRate, platformGstRate }
 *
 * Stored in admin_settings category 'wpay' only (never Marketplace 'fees').
 */
import { z } from 'zod';

const nonNegativeNumber = z.coerce.number().min(0);

export const updateConvenienceSettingsRequestSchema = z
  .object({
    convenienceFee: nonNegativeNumber,
    convenienceGstRate: nonNegativeNumber,
    platformGstRate: nonNegativeNumber,
  })
  .strict();

export type UpdateConvenienceSettingsRequest = z.infer<typeof updateConvenienceSettingsRequestSchema>;

export function parseUpdateConvenienceSettingsRequest(input: unknown): UpdateConvenienceSettingsRequest {
  return updateConvenienceSettingsRequestSchema.parse(input);
}
