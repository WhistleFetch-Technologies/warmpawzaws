import type { CommerceConfiguration } from '../contracts/commerce-configuration';
import type { PublicCommerceConfiguration } from '../contracts/commerce-configuration';
import type {
  CommerceResolveContext,
  CommerceResolveResult,
  CommerceResolver,
} from '../contracts/commerce-resolver';
import type { CommerceConfigurationProvider } from '../contracts/configuration-provider';
import type { CacheProvider } from '../contracts/cache-provider';
import { COMMERCE_SWITCH_CONFIG_CACHE_KEY } from '../cache/cache-keys';
import { DEFAULT_COMMERCE_CONFIGURATION } from '../config/defaults';

const CACHE_TTL_MS = 120_000;

function readEnvForceModel(): string | null {
  const forced = process.env.COMMERCE_SWITCH_FORCE_MODEL?.trim();
  return forced || null;
}

export class DefaultCommerceResolver implements CommerceResolver {
  constructor(
    private readonly configurationProvider: CommerceConfigurationProvider,
    private readonly cache: CacheProvider
  ) {}

  async resolveActiveModel(context?: CommerceResolveContext): Promise<CommerceResolveResult> {
    const config = await this.loadConfiguration();
    const forced = readEnvForceModel();
    if (forced) {
      console.warn('[CommerceSwitch] COMMERCE_SWITCH_FORCE_MODEL override active:', forced);
      return {
        activeModelId: forced as CommerceResolveResult['activeModelId'],
        configurationVersion: config.version,
        resolvedAt: new Date().toISOString(),
        source: 'env_override',
      };
    }

    // Pilot rollout hook — global default until explicitly implemented in a future adapter project.
    void context;

    const cached = this.cache.get<CommerceConfiguration>(COMMERCE_SWITCH_CONFIG_CACHE_KEY);
    return {
      activeModelId: config.activeModelId,
      configurationVersion: config.version,
      resolvedAt: new Date().toISOString(),
      source: cached ? 'cache' : 'database',
    };
  }

  async resolvePublicConfiguration(): Promise<PublicCommerceConfiguration> {
    const config = await this.loadConfiguration();
    return {
      activeModelId: config.activeModelId,
      version: config.version,
      schemaVersion: config.schemaVersion,
      availableModels: config.availableModels,
      updatedAt: config.updatedAt,
    };
  }

  async getConfigurationVersion(): Promise<number> {
    const config = await this.loadConfiguration();
    return config.version;
  }

  private async loadConfiguration(): Promise<CommerceConfiguration> {
    const cached = this.cache.get<CommerceConfiguration>(COMMERCE_SWITCH_CONFIG_CACHE_KEY);
    if (cached?.value) {
      return cached.value;
    }

    const config = await this.configurationProvider.getConfiguration();
    this.cache.set(COMMERCE_SWITCH_CONFIG_CACHE_KEY, config, CACHE_TTL_MS, config.version);
    return config;
  }
}

export function toPublicConfiguration(config: CommerceConfiguration): PublicCommerceConfiguration {
  return {
    activeModelId: config.activeModelId,
    version: config.version,
    schemaVersion: config.schemaVersion,
    availableModels: config.availableModels,
    updatedAt: config.updatedAt,
  };
}

export function getDefaultPublicConfiguration(): PublicCommerceConfiguration {
  return toPublicConfiguration(DEFAULT_COMMERCE_CONFIGURATION);
}
