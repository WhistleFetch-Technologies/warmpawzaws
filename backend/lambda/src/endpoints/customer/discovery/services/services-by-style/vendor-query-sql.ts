import {
  sqlVendorAvailabilityOrNotConfigured,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
  sqlVendorServiceDiscoverable,
} from '../../../../../lib/discovery-vendor-query';
import { sqlWapptCatalogueVendorJoin } from '../shared/wappt-catalogue-vendor-join';
import type { ServicesByStyleCategoryContext } from './types';

export function buildByStyleVendorSql(
  categoryCtx: ServicesByStyleCategoryContext,
  parsed: {
    maxResults: number;
    sqlOffsetByStyle: number;
    specializationByStyleFragment: string;
  },
  sqlOptions?: { wapptCatalogueOnly?: boolean }
): string {
  const {
    catTextExact,
    catUUIDs,
    trainingDiscoverySearchByStyle,
    behaviorHubDiscoverySearchByStyle,
    strictCustomDiscoverySql,
    boardingRoleUncategorizedOrByStyle,
    nutritionRoleUncategorizedOrByStyle,
    trainingRoleUncategorizedOrByStyle,
    trainingRoleCenterBypassOrByStyle,
    trainingCategoryAliasVendorOrByStyle,
    behaviorRoleUncategorizedOrByStyle,
    behaviorCategoryAliasVendorOrByStyle,
    behaviorTrainingCategoryVendorOrByStyle,
    walkerCategoryDiscoveryOrByStyle,
    walkerRoleUncategorizedOrByStyle,
    walkerRoleHomeBypassOrByStyle,
    walkerCustomCategoryIdOrByStyleSql,
    vetCategoryEmptyOrByStyle,
    boardingCustomCategoryIdOrByStyleSql,
    vetExcludeNonVetSqlByStyle,
    logoCol,
    vendorSpecsJsonbSqlByStyle,
  } = categoryCtx;
  const { maxResults, sqlOffsetByStyle, specializationByStyleFragment } = parsed;
  const wapptJoin = sqlWapptCatalogueVendorJoin(sqlOptions?.wapptCatalogueOnly);

  return `
        SELECT DISTINCT ON (v.id)
          v.id AS vendor_id, v.business_name, v.owner_name, v.phone,
          v.address, v.city, v.state, v.latitude, v.longitude, v.pincode, v.metadata,
          ${vendorSpecsJsonbSqlByStyle} AS v_specs_jsonb,
          PLACEHOLDER_VENDOR_DISTANCE_COLS,
          v.profile_photo_url, ${logoCol} AS logo_url, v.vendor_type,
          v.is_online,
          r.id AS role_id,
          r.name AS role_name, r.display_name AS role_display_name,
          r.config AS role_config,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) AS avg_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) AS review_count
        FROM vendors v${wapptJoin}
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND ${sqlVendorDiscoverableStatus('v')}
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          ${specializationByStyleFragment}
          AND EXISTS (
            SELECT 1
            FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND ${sqlVendorServiceDiscoverable('vs', false)}
              AND vs.service_style = ANY($1::text[])
              ${(catTextExact.length + catUUIDs.length > 0) ? `
              AND (
                ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($2::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($3::text[])` : `FALSE`}
                ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
                ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($4::text[])` : ``}
                ${boardingRoleUncategorizedOrByStyle}
                ${nutritionRoleUncategorizedOrByStyle}
                ${trainingRoleUncategorizedOrByStyle}
                ${trainingRoleCenterBypassOrByStyle}
                ${trainingCategoryAliasVendorOrByStyle}
                ${behaviorRoleUncategorizedOrByStyle}
                ${behaviorCategoryAliasVendorOrByStyle}
                ${behaviorTrainingCategoryVendorOrByStyle}
                ${walkerCategoryDiscoveryOrByStyle}
                ${walkerRoleUncategorizedOrByStyle}
                ${walkerRoleHomeBypassOrByStyle}
                ${walkerCustomCategoryIdOrByStyleSql}
                ${vetCategoryEmptyOrByStyle}
                ${boardingCustomCategoryIdOrByStyleSql}
              )` : ``}
              ${strictCustomDiscoverySql}
              ${vetExcludeNonVetSqlByStyle}
          )
          ${trainingDiscoverySearchByStyle || behaviorHubDiscoverySearchByStyle ? '' : `AND ${sqlVendorAvailabilityOrNotConfigured('v')}`}
        ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT ${maxResults} OFFSET ${sqlOffsetByStyle}
      `;
}
