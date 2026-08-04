import { sqlVendorServiceDiscoverable } from '../../../../../lib/discovery-vendor-query';
import * as services_by_styleRepo from '../../repos/services-by-style.repo';
import {
  deduplicateServices,
  mapVendorServiceRowForCustomerDiscoveryList,
} from '../../repos/legacy-helpers.repo';
import {
  buildByStyleServiceFetchParams,
  buildByStyleServiceFetchSql,
} from './fetch-services-sql';
import type { ServicesByStyleCategoryContext, ServicesByStyleParsed } from './types';

export function createByStyleFetchServices(
  parsed: ServicesByStyleParsed,
  categoryCtx: ServicesByStyleCategoryContext
) {
  const { isAtCenter } = parsed;

  return async (vendorId: string, vendorRoleName?: string | null) => {
    const {
      categoryFilterSql,
      strictCustomSqlForFetch,
      vetExcludeForFetchByStyle,
    } = buildByStyleServiceFetchSql(categoryCtx, vendorRoleName);

    const sql = `
          SELECT vs.id, vs.service_id, vs.service_name, vs.price,
                  vs.custom_price,
                  vs.metadata AS vs_metadata,
                  vs.service_style,
                  vs.publish_status,
                  vs.is_enabled,
                  COALESCE(vs.custom_duration, vs.duration_minutes) AS duration,
                  COALESCE(
                    vs.custom_description,
                    sc.description,
                    (SELECT sc2.description FROM service_catalog sc2
                     WHERE sc2.service_name = vs.service_name
                       AND sc2.service_style = vs.service_style LIMIT 1),
                    s.description
                  ) AS description,
                  COALESCE(sc.category_name, vs.category) AS category_name,
                  sc.category_id AS catalog_category_id,
                  sc.service_id AS catalog_service_id
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           LEFT JOIN service_catalog sc ON vs.service_id = sc.id
           WHERE vs.vendor_id = $1
             AND vs.service_style = ANY($2::text[])
             ${isAtCenter ? "AND vs.service_style != 'at_home'" : ''}
            ${categoryFilterSql}
            ${strictCustomSqlForFetch}
            ${vetExcludeForFetchByStyle}
             AND ${sqlVendorServiceDiscoverable('vs', false)}
          ORDER BY vs.price ASC
        `;
    const params = buildByStyleServiceFetchParams(parsed, categoryCtx, vendorId);
    const res = await services_by_styleRepo.dbServicesByStyle2(sql, params).catch(() => ({ rows: [] }));

    return deduplicateServices(res.rows.map((s: any) => mapVendorServiceRowForCustomerDiscoveryList(s)));
  };
}
