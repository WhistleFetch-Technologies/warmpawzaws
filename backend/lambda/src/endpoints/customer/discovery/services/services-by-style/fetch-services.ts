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
                    NULLIF(BTRIM(vs.custom_description), ''),
                    NULLIF(BTRIM(sc.description), ''),
                    (SELECT NULLIF(BTRIM(sc2.description), '') FROM service_catalog sc2
                     WHERE LOWER(BTRIM(COALESCE(sc2.service_name, ''))) = LOWER(BTRIM(COALESCE(vs.service_name, '')))
                       AND BTRIM(COALESCE(vs.service_name, '')) <> ''
                     ORDER BY CASE WHEN sc2.service_style IS NOT DISTINCT FROM vs.service_style THEN 0 ELSE 1 END
                     LIMIT 1),
                    NULLIF(BTRIM(s.description), '')
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
