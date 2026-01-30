/**
 * ============================================================================
 * DISCOVERY API CONTRACTS (DB-driven)
 * ============================================================================
 * Aligns discovery filters with what exists in DB: roles, service styles, categories.
 */

import { z } from 'zod';

export const DiscoveryRoleSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  displayName: z.string(),
  category: z.string().optional(),
});

export const DiscoveryMetaResponseSchema = z.object({
  success: z.boolean().optional(),
  roles: z.array(DiscoveryRoleSchema),
  serviceStyles: z.array(z.enum(['at_center', 'at_home', 'tele'])),
  categories: z.array(z.string()),
});

export type DiscoveryRole = z.infer<typeof DiscoveryRoleSchema>;
export type DiscoveryMetaResponse = z.infer<typeof DiscoveryMetaResponseSchema>;

export const SERVICE_STYLES = ['at_center', 'at_home', 'tele'] as const;
export type ServiceStyle = (typeof SERVICE_STYLES)[number];
