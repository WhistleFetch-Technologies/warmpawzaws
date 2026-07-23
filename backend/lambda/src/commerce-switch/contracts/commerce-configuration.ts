import type { CommerceModelId } from './commerce-model';

export type CommerceRolloutMode = 'global' | 'pilot';

export interface CommerceRolloutConfiguration {
  mode: CommerceRolloutMode;
  pilotVendorIds?: string[];
  effectiveFrom?: string;
}

export interface CommerceFeatureFlags {
  allowAdminSwitch: boolean;
  allowPilotRollout: boolean;
}

export interface CommerceConfiguration {
  version: number;
  schemaVersion: string;
  activeModelId: CommerceModelId;
  availableModels: CommerceModelId[];
  rollout: CommerceRolloutConfiguration;
  features: CommerceFeatureFlags;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicCommerceConfiguration {
  activeModelId: CommerceModelId;
  version: number;
  schemaVersion: string;
  availableModels: CommerceModelId[];
  updatedAt: string;
}
