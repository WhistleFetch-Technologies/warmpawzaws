import { z } from 'zod';

export const updateVendorExportSettingsRequestSchema = z
  .object({
    allowDataDownload: z.coerce.boolean(),
  })
  .strict();

export type UpdateVendorExportSettingsRequest = z.infer<
  typeof updateVendorExportSettingsRequestSchema
>;

export function parseUpdateVendorExportSettingsRequest(
  input: unknown,
): UpdateVendorExportSettingsRequest {
  return updateVendorExportSettingsRequestSchema.parse(input);
}
