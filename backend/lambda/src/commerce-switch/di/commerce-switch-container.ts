import { DefaultCommerceConfigurationProvider } from '../provider/configuration-provider';
import { PlatformSettingsConfigurationRepository } from '../provider/platform-settings-provider';
import { DefaultCommerceResolver } from '../resolver/default-commerce-resolver';
import {
  getDefaultCacheProvider,
  resetDefaultCacheProviderForTests,
} from '../cache/in-memory-cache-provider';
import {
  getCommerceModelRegistry,
  resetCommerceModelRegistryForTests,
} from '../registry/commerce-model-registry';
import { bootstrapCommerceModels } from '../registry/bootstrap-models';
import type { CommerceResolver } from '../contracts/commerce-resolver';
import type { CommerceConfigurationProvider } from '../contracts/configuration-provider';

export interface CommerceSwitchContainer {
  configurationProvider: CommerceConfigurationProvider;
  resolver: CommerceResolver;
  registry: ReturnType<typeof getCommerceModelRegistry>;
}

let container: CommerceSwitchContainer | null = null;
let bootstrapped = false;

function ensureBootstrapped(): void {
  if (!bootstrapped) {
    bootstrapCommerceModels();
    bootstrapped = true;
  }
}

export function createCommerceSwitchContainer(): CommerceSwitchContainer {
  ensureBootstrapped();
  const repository = new PlatformSettingsConfigurationRepository();
  const configurationProvider = new DefaultCommerceConfigurationProvider(repository);
  const resolver = new DefaultCommerceResolver(configurationProvider, getDefaultCacheProvider());
  return {
    configurationProvider,
    resolver,
    registry: getCommerceModelRegistry(),
  };
}

export function getCommerceSwitchContainer(): CommerceSwitchContainer {
  if (!container) {
    container = createCommerceSwitchContainer();
  }
  return container;
}

export function getCommerceResolver(): CommerceResolver {
  return getCommerceSwitchContainer().resolver;
}

export function getCommerceConfigurationProvider(): CommerceConfigurationProvider {
  return getCommerceSwitchContainer().configurationProvider;
}

export function resetCommerceSwitchContainerForTests(): void {
  container = null;
  bootstrapped = false;
  resetDefaultCacheProviderForTests();
  resetCommerceModelRegistryForTests();
}
