import type { Context } from 'hono';
import type { CatalogueDiscoveryOptions } from '../shared/catalogue-discovery-options';
import { buildDiscoverCategoryContext } from './category';
import { createDiscoverFetchServices } from './fetch-services';
import { finishDiscoverServicesResponse } from './finish';
import { parseDiscoverServicesRequest } from './parse';
import { queryAndEnrichDiscoverVendors } from './query-enrich';

export async function executediscoverServices(
  c: Context,
  discoveryOptions: CatalogueDiscoveryOptions = {},
) {
  try {
    const parseResult = await parseDiscoverServicesRequest(c);
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const categoryCtx = await buildDiscoverCategoryContext(parseResult.parsed);
    const fetchServices = createDiscoverFetchServices(parseResult.parsed, categoryCtx);
    const { providers, vendorRows, vendorRadiusLookupDiscover } = await queryAndEnrichDiscoverVendors(
      parseResult.parsed,
      categoryCtx,
      fetchServices,
      discoveryOptions
    );

    return finishDiscoverServicesResponse(
      c,
      parseResult.parsed,
      categoryCtx,
      providers,
      (vendorRows.rows || []).length,
      vendorRadiusLookupDiscover,
      discoveryOptions
    );
  } catch (error: any) {
    console.error('[discover-services] Error:', error);
    return c.json({ error: error.message, success: false }, 500);
  }
}
