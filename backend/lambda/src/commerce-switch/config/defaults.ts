import type { CommerceConfiguration } from '../contracts/commerce-configuration';

export const COMMERCE_CONFIGURATION_SCHEMA_VERSION = '1.0';

export const DEFAULT_COMMERCE_CONFIGURATION: CommerceConfiguration = {
  version: 1,
  schemaVersion: COMMERCE_CONFIGURATION_SCHEMA_VERSION,
  activeModelId: 'marketplace',
  availableModels: ['marketplace'],
  rollout: {
    mode: 'global',
  },
  features: {
    allowAdminSwitch: true,
    allowPilotRollout: false,
  },
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system',
};
