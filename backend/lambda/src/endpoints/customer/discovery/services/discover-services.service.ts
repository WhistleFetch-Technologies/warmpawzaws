import type { Context } from 'hono';
import type { CatalogueDiscoveryOptions } from './shared/catalogue-discovery-options';
import { executediscoverServices as runDiscoverServices } from './discover-services/run';
import { resolveMarketplaceDiscoveryOptions } from './wappt-catalogue-discovery.service';

export type { CatalogueDiscoveryOptions as DiscoverServicesDiscoveryOptions } from './shared/catalogue-discovery-options';

/** GET /customer/discover-services — approved marketplace vendors; no Appointments catalogue gate. */
export async function executediscoverServices(
  c: Context,
  overrideOptions?: CatalogueDiscoveryOptions,
) {
  const discoveryOptions = overrideOptions ?? resolveMarketplaceDiscoveryOptions();
  return runDiscoverServices(c, discoveryOptions);
}
