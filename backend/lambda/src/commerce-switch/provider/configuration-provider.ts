import type { CommerceConfiguration } from '../contracts/commerce-configuration';
import type {
  CommerceConfigurationProvider,
  ConfigurationRepository,
  SaveConfigurationInput,
} from '../contracts/configuration-provider';
import { DEFAULT_COMMERCE_CONFIGURATION } from '../config/defaults';
import { parseCommerceConfiguration } from '../config/schema';
import { getCommerceModelRegistry } from '../registry/commerce-model-registry';
import { invalidateCommerceSwitchCache } from '../cache/in-memory-cache-provider';

export class DefaultCommerceConfigurationProvider implements CommerceConfigurationProvider {
  constructor(private readonly repository: ConfigurationRepository) {}

  async getConfiguration(): Promise<CommerceConfiguration> {
    const stored = await this.repository.getConfiguration();
    if (!stored) {
      return structuredClone(DEFAULT_COMMERCE_CONFIGURATION);
    }
    return parseCommerceConfiguration(stored);
  }

  async saveConfiguration(input: SaveConfigurationInput): Promise<CommerceConfiguration> {
    const current = await this.getConfiguration();
    if (input.expectedVersion != null && input.expectedVersion !== current.version) {
      throw new Error(
        `CONFIG_VERSION_CONFLICT: expected ${input.expectedVersion}, current ${current.version}`
      );
    }

    const registry = getCommerceModelRegistry();
    if (!registry.has(input.configuration.activeModelId)) {
      throw new Error(`UNKNOWN_COMMERCE_MODEL: ${input.configuration.activeModelId}`);
    }
    if (!input.configuration.availableModels.includes(input.configuration.activeModelId)) {
      throw new Error('ACTIVE_MODEL_NOT_IN_AVAILABLE_MODELS');
    }
    for (const modelId of input.configuration.availableModels) {
      if (!registry.has(modelId)) {
        throw new Error(`UNKNOWN_COMMERCE_MODEL: ${modelId}`);
      }
    }

    const next: CommerceConfiguration = parseCommerceConfiguration({
      ...current,
      ...input.configuration,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
    });

    const saved = await this.repository.saveConfiguration(next);
    invalidateCommerceSwitchCache();
    return saved;
  }
}
