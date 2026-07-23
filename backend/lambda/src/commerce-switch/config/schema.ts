import { z } from 'zod';

export const commerceModelIdSchema = z.enum(['marketplace', 'warmpawz_pay']);

export const commerceConfigurationSchema = z.object({
  version: z.number().int().positive(),
  schemaVersion: z.string().min(1),
  activeModelId: commerceModelIdSchema,
  availableModels: z.array(commerceModelIdSchema).min(1),
  rollout: z.object({
    mode: z.enum(['global', 'pilot']),
    pilotVendorIds: z.array(z.string()).optional(),
    effectiveFrom: z.string().datetime().optional(),
  }),
  features: z.object({
    allowAdminSwitch: z.boolean(),
    allowPilotRollout: z.boolean(),
  }),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export const saveCommerceConfigurationBodySchema = z.object({
  activeModelId: commerceModelIdSchema,
  availableModels: z.array(commerceModelIdSchema).min(1),
  rollout: z
    .object({
      mode: z.enum(['global', 'pilot']),
      pilotVendorIds: z.array(z.string()).optional(),
      effectiveFrom: z.string().datetime().optional(),
    })
    .optional(),
  features: z
    .object({
      allowAdminSwitch: z.boolean(),
      allowPilotRollout: z.boolean(),
    })
    .optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export function parseCommerceConfiguration(raw: unknown) {
  return commerceConfigurationSchema.parse(raw);
}

export function parseSaveCommerceConfigurationBody(raw: unknown) {
  return saveCommerceConfigurationBodySchema.parse(raw);
}
