import type { Context } from 'hono';
import type { CatalogueDiscoveryOptions } from './shared/catalogue-discovery-options';
import { executediscoverServices as runDiscoverServices } from './discover-services/run';
import { resolveWarmpawzCatalogueDiscoveryOptions } from './wappt-catalogue-discovery.service';

export type { CatalogueDiscoveryOptions as DiscoverServicesDiscoveryOptions } from './shared/catalogue-discovery-options';

/** GET /customer/discover-services — catalogue filter + no list prices when WAPPT enabled. */
export async function executediscoverServices(
  c: Context,
  overrideOptions?: CatalogueDiscoveryOptions,
) {
  const discoveryOptions = overrideOptions ?? resolveWarmpawzCatalogueDiscoveryOptions();
  return runDiscoverServices(c, discoveryOptions);
}
