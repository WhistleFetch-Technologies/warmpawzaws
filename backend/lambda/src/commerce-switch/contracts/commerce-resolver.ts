import type { CommerceModelId } from './commerce-model';
import type { PublicCommerceConfiguration } from './commerce-configuration';

export type CommerceResolveChannel = 'web' | 'mobile' | 'admin' | 'internal';

export interface CommerceResolveContext {
  vendorId?: string;
  channel?: CommerceResolveChannel;
}

export interface CommerceResolveResult {
  activeModelId: CommerceModelId;
  configurationVersion: number;
  resolvedAt: string;
  source: 'cache' | 'database' | 'default' | 'env_override';
}

export interface CommerceResolver {
  resolveActiveModel(context?: CommerceResolveContext): Promise<CommerceResolveResult>;
  resolvePublicConfiguration(): Promise<PublicCommerceConfiguration>;
  getConfigurationVersion(): Promise<number>;
}
