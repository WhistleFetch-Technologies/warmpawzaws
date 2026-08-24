import type { Context } from 'hono';
import { executeservicesByStyle } from '../../discovery/services/services-by-style.service';
import { resolveWarmpawzCatalogueDiscoveryOptions } from '../../discovery/services/wappt-catalogue-discovery.service';

/** Appointments discovery — published Appointments catalogue only. */
export async function executeDiscoveryByStyleGet(c: Context) {
  return executeservicesByStyle(c, resolveWarmpawzCatalogueDiscoveryOptions());
}
