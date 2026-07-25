import type { CommerceConfiguration } from './commerce-configuration';

export interface SaveConfigurationInput {
  configuration: Omit<CommerceConfiguration, 'version' | 'updatedAt' | 'updatedBy'>;
  expectedVersion?: number;
  updatedBy: string;
}

export interface CommerceConfigurationProvider {
  getConfiguration(): Promise<CommerceConfiguration>;
  saveConfiguration(input: SaveConfigurationInput): Promise<CommerceConfiguration>;
}

export interface ConfigurationRepository {
  getConfiguration(): Promise<CommerceConfiguration | null>;
  saveConfiguration(config: CommerceConfiguration): Promise<CommerceConfiguration>;
}
