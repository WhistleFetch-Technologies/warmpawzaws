import { sqlVendorServiceDiscoverable } from '../../../../../lib/discovery-vendor-query';
import * as discover_servicesRepo from '../../repos/discover-services.repo';
import {
  deduplicateServices,
  mapVendorServiceRowForCustomerDiscoveryList,
} from '../../repos/legacy-helpers.repo';
import {
  buildDiscoverServiceFetchParams,
  buildDiscoverServiceFetchSql,
} from './fetch-services-sql';
import type { DiscoverCategoryContext, DiscoverServicesParsed } from './types';

export function createDiscoverFetchServices(
  parsed: DiscoverServicesParsed,
  categoryCtx: DiscoverCategoryContext
) {
  const { isAtCenter } = parsed;

  return async (vendorId: string, _vendorRoleName?: string | null) => {
    /**
     * Pet Sitting uses relaxed calendar rules but must still filter **services** by sitting-relevant
     * categories (same as vendor EXISTS). Previously `sitterRoleBypass` skipped all category SQL and
     * returned every at_home row for sitters (dog walk / vet / custom boarding leaked into the hub).
     */
    const {
      categoryFilterSql,
      sittingRelaxedFetchCategorySql,
      styleMatchSql,
      sitterRoleBypass,
    } = buildDiscoverServiceFetchSql(categoryCtx, _vendorRoleName, isAtCenter);

    const vsDiscoverSql = sqlVendorServiceDiscoverable('vs', sitterRoleBypass);
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
                   (SELECT sc.description FROM service_catalog sc
                    WHERE sc.service_name = vs.service_name
                      AND sc.service_style = vs.service_style LIMIT 1),
                   s.description
                 ) AS description,
                 vs.category AS category_name
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
             AND ${styleMatchSql}
             ${isAtCenter ? "AND vs.service_style != 'at_home'" : ''}
            ${categoryFilterSql}${sittingRelaxedFetchCategorySql}
             AND ${vsDiscoverSql}
          ORDER BY vs.price ASC
        `;
    const params = buildDiscoverServiceFetchParams(
      parsed,
      categoryCtx,
      sittingRelaxedFetchCategorySql,
      sitterRoleBypass,
      vendorId
    );
    const res = await discover_servicesRepo.dbDiscoverServices2(sql, params).catch(() => ({ rows: [] }));

    return deduplicateServices(res.rows.map((s: any) => mapVendorServiceRowForCustomerDiscoveryList(s)));
  };
}
