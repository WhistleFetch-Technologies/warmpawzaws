import { enrichDiscoveryListVendor, enrichDiscoveryListVendorsConcurrent } from '../../../../../utils/discovery-list-enrich';
import * as services_by_styleRepo from '../../repos/services-by-style.repo';
import {
  batchLoadVendorSpecializationsForDiscovery,
  getNextAvailableSlot,
  resolveSpecializationDiscoveryKeys,
  specializationDiscoveryIlikePatterns,
  sqlVendorMatchesDeclaredSpecialization,
  vendorDistanceSelectColumnsSql,
} from '../../repos/legacy-helpers.repo';
import type {
  ServicesByStyleCategoryContext,
  ServicesByStyleParsed,
  VendorRadiusLookup,
  VendorSpecBundle,
  VendorStatsMap,
} from './types';
import { buildByStyleVendorSql } from './vendor-query-sql';

export type ByStyleQueryEnrichResult = {
  providers: Record<string, unknown>[];
  vendorRows: { rows: any[] };
  vendorRadiusLookupByStyle: VendorRadiusLookup;
  specializationApplied: string | null;
};

export async function queryAndEnrichByStyleVendors(
  parsed: ServicesByStyleParsed,
  categoryCtx: ServicesByStyleCategoryContext,
  fetchServices: (vendorId: string, vendorRoleName?: string | null) => Promise<unknown[]>
): Promise<ByStyleQueryEnrichResult> {
  const {
    problemTitle,
    specializationFilterByStyle,
    fullEnrichByStyle,
    acceptableStyles,
    isAtCenter,
    maxResults,
    sqlOffsetByStyle,
  } = parsed;
  const {
    catTextExact,
    catTextLike,
    catUUIDs,
    vetExcludeNonVetSqlByStyle,
    isVetCategoryDiscoveryByStyle,
    distResolverByStyle,
  } = categoryCtx;

  let vendorSpecBundleForByStyle: VendorSpecBundle = new Map();
  let vendorStatsByStyle: VendorStatsMap = new Map();

  const enrichVendor = async (vendor: any) => {
    const stats = vendorStatsByStyle.get(String(vendor.vendor_id));
    const services = fullEnrichByStyle
      ? await fetchServices(vendor.vendor_id, vendor.role_name)
      : [];
    const specBundle = vendorSpecBundleForByStyle.get(vendor.vendor_id);
    return enrichDiscoveryListVendor({
      vendor,
      stats: fullEnrichByStyle ? null : stats || { serviceCount: 0 },
      services,
      acceptableStyles,
      distResolver: distResolverByStyle,
      getNextAvailableSlot,
      defaultAvailabilityDisplay: 'Tap to view availability',
      problemTitle: problemTitle || undefined,
      specializations: specBundle?.displayLabels?.length ? specBundle.displayLabels : [],
      fullServices: fullEnrichByStyle,
      includeAvailability: true,
    });
  };

  const vendorParamsByStyle: any[] =
    (catTextExact.length + catUUIDs.length > 0)
      ? (catTextExact.length > 0
        ? (catUUIDs.length > 0
          ? [acceptableStyles, catTextExact, catTextLike, catUUIDs]
          : [acceptableStyles, catTextExact, catTextLike])
        : [acceptableStyles, [], [], catUUIDs])
      : [acceptableStyles];

  const specKeysByStyle = await resolveSpecializationDiscoveryKeys(specializationFilterByStyle);
  let specializationByStyleFragment = '';
  if (specKeysByStyle.length > 0) {
    const p0 = vendorParamsByStyle.length + 1;
    specializationByStyleFragment = sqlVendorMatchesDeclaredSpecialization(p0);
    vendorParamsByStyle.push(
      specKeysByStyle.map((k) => k.trim().toLowerCase()),
      specializationDiscoveryIlikePatterns(specKeysByStyle)
    );
  }
  console.log(`[by-style] specialization filter: raw="${specializationFilterByStyle}" keys=${JSON.stringify(specKeysByStyle)} fragmentApplied=${specializationByStyleFragment.length > 0}`);

  const vendorDistanceColsByStyle = await vendorDistanceSelectColumnsSql('v');
  const vendorSql = buildByStyleVendorSql(categoryCtx, {
    maxResults,
    sqlOffsetByStyle,
    specializationByStyleFragment,
  }).replace('PLACEHOLDER_VENDOR_DISTANCE_COLS', vendorDistanceColsByStyle);

  const vendorRows = await services_by_styleRepo.dbServicesByStyle3(vendorSql, vendorParamsByStyle);
  vendorSpecBundleForByStyle = await batchLoadVendorSpecializationsForDiscovery(
    vendorRows.rows || []
  );
  const vendorRadiusLookupByStyle: VendorRadiusLookup = new Map();
  for (const row of vendorRows.rows) {
    vendorRadiusLookupByStyle.set(row.vendor_id, {
      service_radius: row.service_radius,
      service_distance_km: row.service_distance_km,
    });
  }
  const byStyleVendorIds = (vendorRows.rows || []).map((r: any) => String(r.vendor_id));
  if (!fullEnrichByStyle && byStyleVendorIds.length > 0) {
    const vetExcludeExtra = isVetCategoryDiscoveryByStyle
      ? vetExcludeNonVetSqlByStyle
      : undefined;
    const walkerHubAtHome =
      !isAtCenter &&
      catTextExact.some((c) => ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c));
    vendorStatsByStyle = await services_by_styleRepo.dbFetchDiscoveryListStatsForVendors(
      byStyleVendorIds,
      {
        acceptableStyles,
        isAtCenter,
        catTextExact,
        catTextLike,
        catUUIDs,
        walkerHubAtHome,
        extraAndSql: vetExcludeExtra,
      }
    );
  }
  console.log(
    '[by-style] vendorRows',
    vendorRows.rows?.length,
    acceptableStyles,
    catTextExact,
    catTextLike,
    catUUIDs
  );

  const providers = await enrichDiscoveryListVendorsConcurrent(
    vendorRows.rows || [],
    enrichVendor
  );

  return {
    providers: providers as Record<string, unknown>[],
    vendorRows,
    vendorRadiusLookupByStyle,
    specializationApplied: specializationByStyleFragment.length > 0 ? specializationFilterByStyle : null,
  };
}
