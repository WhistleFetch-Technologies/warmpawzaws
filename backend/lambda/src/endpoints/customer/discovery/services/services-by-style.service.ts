import type { Context } from 'hono';
import type { ServicesByStyleDiscoveryOptions } from './services-by-style/discovery-options';
import { executeservicesByStyle as runServicesByStyle } from './services-by-style/run';
import { resolveWarmpawzCatalogueDiscoveryOptions } from './wappt-catalogue-discovery.service';

export type { ServicesByStyleDiscoveryOptions } from './services-by-style/discovery-options';

/** GET /customer/services/by-style — catalogue filter + no list prices when WAPPT enabled. */
export async function executeservicesByStyle(
  c: Context,
  overrideOptions?: ServicesByStyleDiscoveryOptions,
) {
  const discoveryOptions = overrideOptions ?? resolveWarmpawzCatalogueDiscoveryOptions();
  return runServicesByStyle(c, discoveryOptions);
}
