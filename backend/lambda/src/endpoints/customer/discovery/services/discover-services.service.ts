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
  // #region agent log
  fetch('http://127.0.0.1:7284/ingest/8a051ee5-5764-433a-b7be-541c81de6d03',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f40ec1'},body:JSON.stringify({sessionId:'f40ec1',location:'discover-services.service.ts',message:'discover-services wappt options',data:{wapptCatalogueOnly:!!discoveryOptions.wapptCatalogueOnly,omitPricing:!!discoveryOptions.omitPricing,category:c.req.query('category'),serviceStyle:c.req.query('serviceStyle')},timestamp:Date.now(),hypothesisId:'H1',runId:'pre-fix'})}).catch(()=>{});
  // #endregion
  return runDiscoverServices(c, discoveryOptions);
}
