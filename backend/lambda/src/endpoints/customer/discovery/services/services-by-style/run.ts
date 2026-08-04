import type { Context } from 'hono';
import { buildServicesByStyleCategoryContext } from './category';
import { createByStyleFetchServices } from './fetch-services';
import { finishServicesByStyleResponse } from './finish';
import { parseServicesByStyleRequest } from './parse';
import { queryAndEnrichByStyleVendors } from './query-enrich';

export async function executeservicesByStyle(c: Context) {
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
      fetchServices
    );

    return finishServicesByStyleResponse(
      c,
      parseResult.parsed,
      categoryCtx,
      providers,
      (vendorRows.rows || []).length,
      vendorRadiusLookupByStyle,
      specializationApplied
    );
  } catch (error: any) {
    console.error('[by-style] Error:', error);
    return c.json({ error: error.message, success: false }, 500);
  }
}
