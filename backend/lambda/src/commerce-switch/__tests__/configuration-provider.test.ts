import { DefaultCommerceConfigurationProvider } from '../provider/configuration-provider';
import { DEFAULT_COMMERCE_CONFIGURATION } from '../config/defaults';
import type { ConfigurationRepository } from '../contracts/configuration-provider';
import { bootstrapCommerceModels } from '../registry/bootstrap-models';
import { resetCommerceSwitchContainerForTests } from '../di/commerce-switch-container';

describe('DefaultCommerceConfigurationProvider', () => {
  beforeEach(() => {
    resetCommerceSwitchContainerForTests();
    bootstrapCommerceModels();
  });

  it('increments version on save', async () => {
    let stored = structuredClone(DEFAULT_COMMERCE_CONFIGURATION);
    const repo: ConfigurationRepository = {
      getConfiguration: async () => stored,
      saveConfiguration: async (config) => {
        stored = config;
        return config;
      },
    };
    const provider = new DefaultCommerceConfigurationProvider(repo);
    const saved = await provider.saveConfiguration({
      updatedBy: 'test-admin',
      configuration: {
        schemaVersion: stored.schemaVersion,
        activeModelId: 'marketplace',
        availableModels: ['marketplace'],
        rollout: stored.rollout,
        features: stored.features,
      },
    });
    expect(saved.version).toBe(2);
  });
});
