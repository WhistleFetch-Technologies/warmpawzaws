import {
  buildDiscoveryVendorExistsSql,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
} from '../../../../../lib/discovery-vendor-query';
import { enrichDiscoveryListVendor, enrichDiscoveryListVendorsConcurrent } from '../../../../../utils/discovery-list-enrich';
import * as discover_servicesRepo from '../../repos/discover-services.repo';
import {
  batchLoadVendorSpecializationsForDiscovery,
  getNextAvailableSlot,
  resolveSpecializationDiscoveryKeys,
  specializationDiscoveryIlikePatterns,
  sqlVendorMatchesDeclaredSpecialization,
  vendorDistanceSelectColumnsSql,
} from '../../repos/legacy-helpers.repo';
import type {
  DiscoverCategoryContext,
  DiscoverServicesParsed,
  VendorRadiusLookup,
  VendorSpecBundle,
  VendorStatsMap,
} from './types';

export type DiscoverQueryEnrichResult = {
  providers: Record<string, unknown>[];
  vendorRows: { rows: any[] };
  vendorRadiusLookupDiscover: VendorRadiusLookup;
};

export async function queryAndEnrichDiscoverVendors(
  parsed: DiscoverServicesParsed,
  categoryCtx: DiscoverCategoryContext,
  fetchServices: (vendorId: string, vendorRoleName?: string | null) => Promise<unknown[]>
): Promise<DiscoverQueryEnrichResult> {
  const {
    category,
    roleId,
    serviceStyleNormDiscover,
    problemTitle,
    specializationFilterDiscover,
    fullEnrichDiscover,
    acceptableStyles,
    isAtCenter,
    maxResults,
    sqlOffset,
  } = parsed;
  const {
    catTextExact,
    catTextLike,
    catUUIDs,
    sittingDiscoveryRelaxed,
    logoCol,
    vendorSpecsJsonbSql,
    distResolverDiscover,
  } = categoryCtx;

  let vendorSpecBundleForDiscover: VendorSpecBundle = new Map();
  let vendorStatsDiscover: VendorStatsMap = new Map();

  const enrichVendor = async (vendor: any) => {
    const stats = vendorStatsDiscover.get(String(vendor.vendor_id));
    const services = fullEnrichDiscover
      ? await fetchServices(vendor.vendor_id, vendor.role_name)
      : [];
    const specBundle = vendorSpecBundleForDiscover.get(vendor.vendor_id);
    return enrichDiscoveryListVendor({
      vendor,
      stats: fullEnrichDiscover ? null : stats || { serviceCount: 0 },
      services,
      acceptableStyles,
      distResolver: distResolverDiscover,
      getNextAvailableSlot,
      defaultAvailabilityDisplay: sittingDiscoveryRelaxed
        ? 'Contact for availability'
        : 'Tap to view availability',
      problemTitle: problemTitle || undefined,
      specializations: specBundle?.displayLabels?.length ? specBundle.displayLabels : [],
      fullServices: fullEnrichDiscover,
      includeAvailability: false,
    });
  };

  const vendorExistsDiscover = await buildDiscoveryVendorExistsSql({
    category,
    roleId,
    serviceStyle: serviceStyleNormDiscover,
    sittingRelaxed: sittingDiscoveryRelaxed,
    paramOffset: 1,
    isAtCenter,
    forVendorCount: false,
  });
  const vendorParamsDiscover: any[] = [...vendorExistsDiscover.params];

  const specKeysDiscover = await resolveSpecializationDiscoveryKeys(specializationFilterDiscover);
  let specializationDiscoverFragment = '';
  if (specKeysDiscover.length > 0) {
    const p0 = vendorParamsDiscover.length + 1;
    specializationDiscoverFragment = sqlVendorMatchesDeclaredSpecialization(p0);
    vendorParamsDiscover.push(
      specKeysDiscover.map((k) => k.trim().toLowerCase()),
      specializationDiscoveryIlikePatterns(specKeysDiscover)
    );
  }

  const vendorDistanceColsDiscover = await vendorDistanceSelectColumnsSql('v');
  const vendorSql = `
        SELECT DISTINCT ON (v.id)
          v.id AS vendor_id, v.business_name, v.owner_name, v.phone,
          v.address, v.city, v.state, v.latitude, v.longitude, v.pincode, v.metadata,
          ${vendorSpecsJsonbSql} AS v_specs_jsonb,
          ${vendorDistanceColsDiscover},
          v.profile_photo_url, ${logoCol} AS logo_url, v.vendor_type,
          v.is_online,
          r.id AS role_id,
          r.name AS role_name, r.display_name AS role_display_name,
          r.config AS role_config,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) AS avg_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) AS review_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND ${sqlVendorDiscoverableStatus('v')}
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          ${specializationDiscoverFragment}
          AND ${vendorExistsDiscover.sql}
          ${vendorExistsDiscover.availabilitySql}
        ORDER BY v.id, avg_rating DESC NULLS LAST
        LIMIT ${maxResults} OFFSET ${sqlOffset}
      `;

  const vendorRows = await discover_servicesRepo.dbDiscoverServices3(vendorSql, vendorParamsDiscover);
  vendorSpecBundleForDiscover = await batchLoadVendorSpecializationsForDiscovery(
    vendorRows.rows || []
  );
  const vendorRadiusLookupDiscover: VendorRadiusLookup = new Map();
  for (const row of vendorRows.rows) {
    vendorRadiusLookupDiscover.set(row.vendor_id, {
      service_radius: row.service_radius,
      service_distance_km: row.service_distance_km,
    });
  }
  const discoverVendorIds = (vendorRows.rows || []).map((r: any) => String(r.vendor_id));
  if (!fullEnrichDiscover && discoverVendorIds.length > 0) {
    const sittingExcludeExtra = sittingDiscoveryRelaxed
      ? `AND NOT (
                LOWER(TRIM(COALESCE(vs.category, ''))) = ANY(ARRAY[
                  'walking','walker','dog_walker','dog walking','dog walker','dog_walking',
                  'vet','veterinary','veterinarian','vet care','vet_care',
                  'grooming','training','diagnostics','behaviourist','nutrition','daycare','transport'
                ]::text[])
                OR (
                  LOWER(TRIM(COALESCE(vs.category, ''))) = 'boarding'
                  AND COALESCE(vs.is_custom_service, false) = true
                )
              )`
      : undefined;
    vendorStatsDiscover = await discover_servicesRepo.dbFetchDiscoveryListStatsForVendors(
      discoverVendorIds,
      {
        acceptableStyles,
        isAtCenter,
        sittingStyleLoose: sittingDiscoveryRelaxed && !isAtCenter,
        allowNullEnabled: sittingDiscoveryRelaxed,
        catTextExact,
        catTextLike,
        catUUIDs,
        extraAndSql: sittingExcludeExtra,
      }
    );
  }
  console.log('vendorRows', vendorRows.rows?.length, acceptableStyles, catTextExact, catTextLike, catUUIDs);

  const providers = await enrichDiscoveryListVendorsConcurrent(
    vendorRows.rows || [],
    enrichVendor
  );

  return {
    providers: providers as Record<string, unknown>[],
    vendorRows,
    vendorRadiusLookupDiscover,
  };
}
