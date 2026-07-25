export type CommerceModelId = 'marketplace' | 'warmpawz_pay';

export type CommerceModelStatus = 'active' | 'deprecated' | 'experimental';

export interface CommerceModelDescriptor {
  id: CommerceModelId;
  displayName: string;
  description: string;
  status: CommerceModelStatus;
  introducedInVersion: string;
  capabilities: string[];
}

export interface PublicCommerceConfiguration {
  activeModelId: CommerceModelId;
  version: number;
  schemaVersion: string;
  availableModels: CommerceModelId[];
  updatedAt: string;
  degraded?: boolean;
}

export interface CommerceConfiguration extends PublicCommerceConfiguration {
  rollout: {
    mode: 'global' | 'pilot';
    pilotVendorIds?: string[];
    effectiveFrom?: string;
  };
  features: {
    allowAdminSwitch: boolean;
    allowPilotRollout: boolean;
  };
  updatedBy: string;
}

/** Domains that never consume Commerce Switch routing (fixed in both modes). */
export const COMMERCE_SWITCH_EXCLUDED_DOMAINS = [
  'tele',
  'nutrition',
  'ecommerce',
  'pharmacy',
  'meal',
  'package',
  'subscription',
] as const;

export type CommerceSwitchExcludedDomain = (typeof COMMERCE_SWITCH_EXCLUDED_DOMAINS)[number];

export const COMMERCE_SWITCH_ENDPOINTS = {
  CONFIG: '/config/commerce-switch',
  CONFIG_HEALTH: '/config/commerce-switch/health',
  ADMIN_CONFIGURATION: '/admin/commerce-switch/configuration',
  ADMIN_MODELS: '/admin/commerce-switch/models',
  ADMIN_STATUS: '/admin/commerce-switch/status',
  ADMIN_VALIDATE: '/admin/commerce-switch/validate',
} as const;

export const DEFAULT_COMMERCE_MODEL_ID: CommerceModelId = 'marketplace';
