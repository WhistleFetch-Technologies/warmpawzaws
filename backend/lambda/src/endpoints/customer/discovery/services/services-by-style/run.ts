import type { Context } from 'hono';
import { buildServicesByStyleCategoryContext } from './category';
import type { ServicesByStyleDiscoveryOptions } from './discovery-options';
import { createByStyleFetchServices } from './fetch-services';
import { finishServicesByStyleResponse } from './finish';
import { parseServicesByStyleRequest } from './parse';
import { queryAndEnrichByStyleVendors } from './query-enrich';

export type { ServicesByStyleDiscoveryOptions } from './discovery-options';

export async function executeservicesByStyle(
  c: Context,
  discoveryOptions: ServicesByStyleDiscoveryOptions = {}
) {
  try {
    const parseResult = await parseServicesByStyleRequest(c);
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const categoryCtx = await buildServicesByStyleCategoryContext(parseResult.parsed);
    const fetchServices = createByStyleFetchServices(parseResult.parsed, categoryCtx);
    const { providers, vendorRows, vendorRadiusLookupByStyle, specializationApplied } =
      await queryAndEnrichByStyleVendors(
        parseResult.parsed,
        categoryCtx,
        fetchServices,
        discoveryOptions
      );

    return finishServicesByStyleResponse(
      c,
      parseResult.parsed,
      categoryCtx,
      providers,
      (vendorRows.rows || []).length,
      vendorRadiusLookupByStyle,
      specializationApplied,
      discoveryOptions
    );
  } catch (error: any) {
    console.error('[by-style] Error:', error);
    return c.json({ error: error.message, success: false }, 500);
  }
}
