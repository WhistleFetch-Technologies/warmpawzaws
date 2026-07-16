import type { Context } from 'hono';
import * as discover_by_problemRepo from '../repos/discover-by-problem.repo';
import type { Hono } from 'hono';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules, type DiscoveryRuleSet } from '../../../../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from '../../../vendor/endpoints/vendorProfile.vendor';
import { taxCalculationService } from '../../../../lib/services/tax-calculation-service';
import { discountCalculationService } from '../../../../lib/services/discount-calculation-service';
import { CATEGORY_ROLES } from '../../constants';
import { extractS3KeyFromUrl, regeneratePresignedUrl } from '../../../constants/helper';
import { getCustomerCoordinates, resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { seedFinitePackagesMissingSessionsForScope, type SqlClient } from '../../../../utils/package-session-sync';
import { sqlPackagePurchaseActiveForListing } from '../../../../utils/package-session-eligibility';
import { DistanceResolver, haversineKm, formatDistanceKm } from '../../../../lib/utils/vendor-customer-distance';
import {
  appendVetDiscoveryCategoryAliasKeys,
  buildDiscoveryVendorExistsSql,
  sqlVendorAvailabilityOrNotConfigured,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
  sqlVendorServiceDiscoverable,
  sqlVendorServicesHubCategoryFilter,
  vendorServicesHubCategoryBindParams,
  sqlVetHubExcludeNonVetServices,
  sqlVetHubPlaceholderCategoryOr,
  VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL,
  isVetHubCategoryRequest,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  catTextRequestsBehaviorHub,
  sqlTrainingCategoryAliasOrVs,
} from '../../../../lib/discovery-vendor-query';
import { acceptableAvailabilityStylesForSlot, normalizeAvailabilityServiceStyle } from '../../../../utils/availability-service-styles';
import { vendorGalleryDrivesListingPhoto, getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import {
  addDaysToYmd,
  dayOfWeekFromYmd,
  DEFAULT_MIN_NOTICE_MINUTES,
  formatNextAvailableDisplay,
  isSlotPastInIst,
  ymdInIst,
} from '../../../../utils/ist-scheduling';
import {
  filterSearchResultsByDiscoveryRules,
  hubSlugToDiscoveryContext,
  loadVendorRadiusMetaByIds,
  type HubDiscoveryContext,
} from '../../../../lib/search-discovery-parity';
import {
  uploadDisplayImage,
  ImageProcessingError,
  FACILITY_MAX_PHOTOS,
  mapWithConcurrency,
  resolveImageForContext,
} from '../../../../services/image';
import {
  acceptableStylesForService,
  getCustomerCoordinates,
  getNextAvailableSlot,
  normalizeServiceStyle,
  resolveSpecializationDiscoveryKeys,
  resolveTargetRolesForDiscovery,
  roleConfigAllowsStyle,
} from '../repos/legacy-helpers.repo';

export async function executediscoverByProblem(c: Context) {

    try {
      const problem = c.req.query('problem') || c.req.query('problemId');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      // Accept both lat/lon and latitude/longitude — frontend code uses both.
      let latitude = c.req.query('latitude') || c.req.query('lat');
      let longitude = c.req.query('longitude') || c.req.query('lon') || c.req.query('lng');
      const customerPhoneByProblem =
        c.req.query('customerPhone') || c.req.query('phone');

      if (!problem) {
        return c.json({ error: 'problem or problemId is required' }, 400);
      }

      // Fall back to the customer's saved default address (or pincode
      // centroid) when the caller didn't pass coordinates. Without this
      // every "discover by problem" hit on a freshly-loaded UI would
      // render empty distances.
      let customerApproximateByProblem = false;
      if ((!latitude || !longitude) && customerPhoneByProblem) {
        try {
          const coords = await getCustomerCoordinates(customerPhoneByProblem);
          if (coords) {
            latitude = String(coords.latitude);
            longitude = String(coords.longitude);
            customerApproximateByProblem = !!coords.approximate;
            console.log(
              `[discover-by-problem] Resolved customer coords from default address: ${latitude}, ${longitude}, approx=${customerApproximateByProblem}`
            );
          }
        } catch (err) {
          console.warn(
            '[discover-by-problem] getCustomerCoordinates fallback failed:',
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      const specKeysByProblem = await resolveSpecializationDiscoveryKeys(String(problem).trim());
      const exactKeysForProblem = [...new Set(specKeysByProblem.filter(Boolean))];
      const problemPattern = `%${problem}%`;

      // Get vendors that handle this problem (specialization_id): check vendors.specializations, metadata.specializations, vendor_specializations, or service name/description
      let queryText = `
        SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          AND (
            (v.specializations IS NOT NULL AND v.specializations::text ILIKE $2) OR
            (v.metadata IS NOT NULL AND v.metadata->'specializations' IS NOT NULL AND (v.metadata->'specializations')::text ILIKE $2) OR
            EXISTS (SELECT 1 FROM vendor_specializations vs WHERE vs.vendor_id = v.id AND (vs.specialization = ANY(executediscoverByProblem::text[]) OR vs.specialization ILIKE $2)) OR
            EXISTS (SELECT 1 FROM vendor_services s WHERE s.vendor_id = v.id AND s.is_enabled = true AND (s.service_name ILIKE $2 OR (s.custom_description IS NOT NULL AND s.custom_description::text ILIKE $2)))
          )
      `;

      const params: any[] = [exactKeysForProblem.length > 0 ? exactKeysForProblem : [String(problem).trim()], problemPattern];
      let paramIdx = 3;

      if (roleId) {
        const targetRoles = await resolveTargetRolesForDiscovery(null, roleId);
        if (targetRoles.length > 0) {
          queryText += ` AND r.name = ANY(${paramIdx}::text[])`;
          params.push(targetRoles);
          paramIdx++;
        } else {
          // ✅ FIX: Use only role name comparison (case-insensitive), not id::text
          queryText += ` AND (LOWER(r.name) = LOWER(${paramIdx}) OR LOWER(r.display_name) = LOWER(${paramIdx}))`;
          params.push(roleId);
          paramIdx++;
        }
      }

      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        queryText += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.service_style = ANY(${paramIdx}::text[])
            AND vs.is_enabled = true 
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )`;
        params.push(acceptableStyles);
        paramIdx++;
      }

      // Compute SQL-level distance only for vendors that already have lat/lng;
      // vendors without coordinates remain in the result set and have their
      // distance resolved later via the address/pincode fallback resolver
      // (otherwise centers without a saved map pin would silently disappear).
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        queryText = `
          SELECT subquery.*,
            CASE
              WHEN subquery.latitude IS NOT NULL AND subquery.longitude IS NOT NULL
              THEN (6371 * acos(
                cos(radians(${paramIdx})) * cos(radians(CAST(subquery.latitude AS FLOAT))) *
                cos(radians(CAST(subquery.longitude AS FLOAT)) - radians(${paramIdx + 1})) +
                sin(radians(${paramIdx})) * sin(radians(CAST(subquery.latitude AS FLOAT)))
              ))
              ELSE NULL
            END AS distance_km
          FROM (${queryText}) subquery
          ORDER BY distance_km ASC NULLS LAST
        `;
        params.push(lat, lng);
        paramIdx += 2;
      } else {
        queryText += ` ORDER BY v.created_at DESC`;
      }

      queryText += ` LIMIT 20`;

      const result = await discover_by_problemRepo.dbDiscoverByProblem0(queryText, params)

      // Per-request resolver: backfills distance for rows whose vendor row had
      // no lat/lng (using full-address or pincode-centroid geocoding).
      const customerLatByProblem =
        latitude != null && latitude !== '' ? parseFloat(String(latitude)) : NaN;
      const customerLngByProblem =
        longitude != null && longitude !== '' ? parseFloat(String(longitude)) : NaN;
      const distResolverByProblem = new DistanceResolver(
        Number.isFinite(customerLatByProblem) ? customerLatByProblem : null,
        Number.isFinite(customerLngByProblem) ? customerLngByProblem : null,
        customerApproximateByProblem
      );

      // Enrich with unified card shape: photoUrl, rating, reviewCount, specializations, nextAvailable, distanceText
      const enriched = await Promise.all((result.rows || []).map(async (row: any) => {
        const vendorId = row.id || row.vendor_id;
        let rating = 0;
        let reviewCount = 0;
        try {
          const rev = await discover_by_problemRepo.dbDiscoverByProblem1(vendorId)
          rating = parseFloat(rev.rows[0]?.avg_rating || '0');
          reviewCount = parseInt(rev.rows[0]?.c || '0', 10);
        } catch (_) { }
        let specializations: string[] = [];
        try {
          const specRes = await discover_by_problemRepo.dbDiscoverByProblem2(vendorId)
          specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
        } catch (_) { }
        if (specializations.length === 0 && row.specializations) {
          specializations = Array.isArray(row.specializations) ? row.specializations : (typeof row.specializations === 'string' ? JSON.parse(row.specializations || '[]') : []);
        }
        let nextAvailable: { date: string; time: string; display: string } | null = null;
        try {
          nextAvailable = await getNextAvailableSlot(vendorId, row.phone || '');
        } catch (_) { }
        let distanceKm: number | null =
          row.distance_km != null ? parseFloat(row.distance_km) : null;
        let distanceText: string | null =
          distanceKm != null
            ? formatDistanceKm(distanceKm, customerApproximateByProblem)
            : null;
        // Vendors with no lat/lng on the row: backfill via address / pincode
        // geocoding so every center / clinic surfaces a distance instead of
        // a blank line under the rating.
        if (
          distanceKm == null &&
          Number.isFinite(customerLatByProblem) &&
          Number.isFinite(customerLngByProblem)
        ) {
          try {
            const distResult = await distResolverByProblem.resolve({
              id: vendorId,
              latitude: row.latitude,
              longitude: row.longitude,
              pincode: row.pincode,
              address: row.address,
              city: row.city,
              state: row.state,
            });
            if (distResult) {
              distanceKm = parseFloat(distResult.km.toFixed(2));
              distanceText = distResult.distanceText;
            }
          } catch {
            /* non-fatal: leave null */
          }
        }
        const normalizedStyle = normalizeServiceStyle(serviceStyle || '') || serviceStyle || '';
        return {
          id: vendorId,
          vendorId,
          name: row.business_name || row.owner_name,
          photoUrl: await getVendorListingPhotoUrl(row),
          rating,
          reviewCount,
          distance: distanceKm,
          distanceKm,
          distanceText,
          specializations,
          nextAvailable,
          vendorType: row.vendor_type === 'solo' ? 'solo' : 'business',
          roleName: row.role_name || row.role_display_name || '',
          serviceStyles: serviceStyle ? (normalizedStyle ? [normalizedStyle] : []) : [], // discovery by problem does not filter by style unless provided
          ...row,
        };
      }));

      // Role gate (Admin catalogue): drop vendors whose role does not allow the requested style
      const filteredResults = enriched.filter((r: any) =>
        !serviceStyle || roleConfigAllowsStyle((r as any).role_config, serviceStyle)
      );

      return c.json({
        success: true,
        results: filteredResults,
        roleConfig: roleId ? { roleId } : null,
      });
    } catch (error: any) {
      console.error('Error in discover-by-problem:', error);
      return c.json({ error: error.message }, 500);
    }
}
