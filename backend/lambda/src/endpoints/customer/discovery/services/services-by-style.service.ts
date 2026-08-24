import type { Context } from 'hono';
import type { ServicesByStyleDiscoveryOptions } from './services-by-style/discovery-options';
import { executeservicesByStyle as runServicesByStyle } from './services-by-style/run';
import { resolveMarketplaceDiscoveryOptions } from './wappt-catalogue-discovery.service';

export type { ServicesByStyleDiscoveryOptions } from './services-by-style/discovery-options';

/** GET /customer/services/by-style — approved marketplace vendors; no Appointments catalogue gate. */
export async function executeservicesByStyle(
  c: Context,
  overrideOptions?: ServicesByStyleDiscoveryOptions,
) {
  const discoveryOptions = overrideOptions ?? resolveMarketplaceDiscoveryOptions();
  return runServicesByStyle(c, discoveryOptions);
}
