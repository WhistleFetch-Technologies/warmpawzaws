import type { Context } from 'hono';
import * as vendors_searchRepo from '../repos/vendors-search.repo';
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
  hubContextForVendorSearch,
  normalizeServiceStyle,
  resolveCustomerIdFromPhone,
  resolveTargetRolesForDiscovery,
  roleConfigAllowsStyle,
} from '../repos/legacy-helpers.repo';

export async function executevendorsSearch(c: Context) {

    try {
      const roleId = c.req.query('roleId');
      const searchQuery = c.req.query('query');
      const location = c.req.query('location');
      // Accept both lat/lon and latitude/longitude — frontend code uses both spellings.
      let latitude = c.req.query('latitude') || c.req.query('lat');
      let longitude = c.req.query('longitude') || c.req.query('lon') || c.req.query('lng');
      const serviceStyle = c.req.query('serviceStyle');
      const customerPhone = c.req.query('customerPhone') || c.req.query('phone');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // If coordinates not provided, fall back to the customer's default address
      // (with pincode-centroid geocoding when the address has no saved pin).
      let customerApproximate = false;
      if ((!latitude || !longitude) && customerPhone) {
        try {
          const coords = await getCustomerCoordinates(customerPhone);
          if (coords) {
            latitude = String(coords.latitude);
            longitude = String(coords.longitude);
            customerApproximate = !!coords.approximate;
            console.log(
              `[vendors/search] Resolved customer coords from default address: ${latitude}, ${longitude}, approx=${customerApproximate}`
            );
          }
        } catch (err) {
          console.warn(
            '[vendors/search] getCustomerCoordinates fallback failed:',
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by roleId (primary filter) - expand to category roles when roleId is a category key
      if (roleId) {
        const targetRoles = await resolveTargetRolesForDiscovery(null, roleId);
        if (targetRoles.length > 0) {
          vendorQuery += ` AND r.name = ANY(${paramIndex}::text[])`;
          params.push(targetRoles);
          paramIndex++;
        } else {
          // ✅ FIX: Use only role name/display_name comparison (case-insensitive), not id::text
          vendorQuery += ` AND (LOWER(r.name) = LOWER(${paramIndex}) OR LOWER(r.display_name) = LOWER(${paramIndex}))`;
          params.push(roleId);
          paramIndex++;
        }
      }

      // ✅ Vendor discovery rules: filter by service style; enforce publish_status = 'published' (align with discover-services)
      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        vendorQuery += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.service_style = ANY(${paramIndex}::text[]) 
            AND vs.is_enabled = true 
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )`;
        params.push(acceptableStyles);
        paramIndex++;
      }

      // Filter by search query (name, business_name, specialization)
      if (searchQuery) {
        vendorQuery += ` AND (
          v.business_name ILIKE ${paramIndex} OR 
          v.owner_name ILIKE ${paramIndex} OR
          v.specialization ILIKE ${paramIndex}
        )`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      // Filter by location
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE ${paramIndex} OR 
          v.state ILIKE ${paramIndex} OR 
          v.address ILIKE ${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`;
      params.push(limit, offset);
      paramIndex += 2;

      const vendorResults = await vendors_searchRepo.dbVendorsSearch0(vendorQuery, params)
      let vendors = vendorResults.rows;

      // Vendor IDs where this customer has an active package (for "Package active" badge)
      let vendorIdsWithActivePackage = new Set<string>();
      if (customerPhone) {
        try {
          const customerId = await resolveCustomerIdFromPhone(customerPhone);
          if (customerId) {
            await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, { customerId });
            const activePackages = await vendors_searchRepo.dbVendorsSearch1()
            (activePackages.rows || []).forEach((r: any) => {
              if (r.vendor_id) vendorIdsWithActivePackage.add(r.vendor_id);
            });
          }
        } catch (_) { }
      }

      // Build a per-request distance resolver that handles vendors without
      // explicit lat/lng by geocoding their address (and persists the coords
      // back so the next search/discovery call is fast).
      const customerLatNum =
        latitude != null && latitude !== '' ? parseFloat(String(latitude)) : NaN;
      const customerLngNum =
        longitude != null && longitude !== '' ? parseFloat(String(longitude)) : NaN;
      const distResolverSearch = new DistanceResolver(
        Number.isFinite(customerLatNum) ? customerLatNum : null,
        Number.isFinite(customerLngNum) ? customerLngNum : null,
        customerApproximate
      );

      // Enrich vendors with unified card shape: photoUrl, specializations, nextAvailable, distanceText, serviceStyles
      const enrichedVendors = (await Promise.all(
        vendors.map(async (vendor: any) => {
          if (serviceStyle && !roleConfigAllowsStyle((vendor as any).role_config, serviceStyle)) {
            return null;
          }
          const reviews = await vendors_searchRepo.dbVendorsSearch2(vendor)
          const avgRating = reviews.rows[0]?.avg_rating || 0;
          const reviewCount = reviews.rows[0]?.review_count || 0;

          // Resolve distance through the shared resolver: explicit lat/lng,
          // then full-address geocode, then pincode centroid. Returns null
          // only when the customer has no usable reference point.
          const distResult = await distResolverSearch.resolve({
            id: vendor.id,
            latitude: vendor.latitude,
            longitude: vendor.longitude,
            pincode: vendor.pincode,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
          });
          const distanceKm =
            distResult?.km != null ? parseFloat(distResult.km.toFixed(2)) : null;
          const distanceText = distResult?.distanceText ?? null;

          let specializations: string[] = [];
          try {
            const specRes = await vendors_searchRepo.dbVendorsSearch3(vendor)
            specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
          } catch (_) { }
          if (specializations.length === 0 && vendor.specializations) {
            specializations = Array.isArray(vendor.specializations) ? vendor.specializations : (typeof vendor.specializations === 'string' ? JSON.parse(vendor.specializations || '[]') : []);
          }

          let nextAvailable: { date: string; time: string; display: string } | null = null;
          try {
            const styleArray = serviceStyle === 'at_center' ? ['at_center', 'at_vendor'] : serviceStyle === 'tele' ? ['tele', 'online', 'video_consultation'] : [serviceStyle].filter(Boolean);
            if (styleArray.length > 0) {
              nextAvailable = await getNextAvailableSlot(vendor.id, vendor.phone || '', styleArray);
            }
          } catch (_) { }

          const servicesCountRes = await vendors_searchRepo.dbVendorsSearch4(vs, vendor)
          const servicesCount = parseInt(servicesCountRes.rows[0]?.count || '0');
          const minPriceRes = await vendors_searchRepo.dbVendorsSearch5(vendor)
          const minPrice = minPriceRes.rows[0]?.min_price != null ? parseFloat(minPriceRes.rows[0].min_price) : undefined;

          const vendorType = vendor.vendor_type === 'solo' ? 'solo' : 'business';
          const roleName = vendor.role_name || vendor.role_display_name || '';
          const normalizedStyle = normalizeServiceStyle(serviceStyle || '') || serviceStyle || '';

          return {
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name,
            name: vendor.business_name || vendor.owner_name,
            photoUrl: await getVendorListingPhotoUrl(vendor),
            rating: parseFloat(avgRating) || 0,
            reviewCount: parseInt(reviewCount) || 0,
            distanceKm,
            distance: distanceKm,
            distanceText,
            specializations,
            nextAvailable,
            serviceStyles: serviceStyle ? (normalizedStyle ? [normalizedStyle] : []) : ['at_center', 'at_home', 'tele'],
            minPrice,
            vendorType,
            roleName,
            servicesCount,
            priceRange: vendor.price_range || null,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            hasActivePackage: vendorIdsWithActivePackage.has(vendor.id),
          };
        })
      )).filter(Boolean);

      const hubForSearch = hubContextForVendorSearch(roleId || undefined, serviceStyle || undefined);
      const styleNormSearch =
        normalizeServiceStyle(serviceStyle || hubForSearch.serviceStyle) || hubForSearch.serviceStyle;
      const rulesForSearch = await getDiscoveryRules(
        hubForSearch.roleId || hubForSearch.discoverCategory || 'all',
        'discover',
        styleNormSearch,
        hubForSearch.discoverCategory
      );
      const userCoordsSearch =
        Number.isFinite(customerLatNum) && Number.isFinite(customerLngNum)
          ? { lat: customerLatNum, lng: customerLngNum }
          : null;
      const vendorRadiusByIdSearch = await loadVendorRadiusMetaByIds(
        enrichedVendors.map((v: { id: string }) => String(v.id))
      );
      const radiusFiltered = filterSearchResultsByDiscoveryRules({
        vendors: enrichedVendors.map((v: any) => ({
          id: String(v.id),
          latitude: v.latitude != null ? parseFloat(String(v.latitude)) : null,
          longitude: v.longitude != null ? parseFloat(String(v.longitude)) : null,
          distanceKm: v.distanceKm ?? null,
          is_online: v.is_online,
        })),
        services: [],
        userCoords: userCoordsSearch,
        hub: { ...hubForSearch, serviceStyle: styleNormSearch as HubDiscoveryContext['serviceStyle'] },
        rules: rulesForSearch,
        radiusFromQuery: c.req.query('radius') || undefined,
        maxDistanceFromQuery: c.req.query('maxDistance') || undefined,
        vendorRadiusById: vendorRadiusByIdSearch,
      });
      const allowedVendorIdsSearch = new Set(radiusFiltered.vendors.map((v) => v.id));
      const filteredEnrichedVendors = enrichedVendors.filter((v: { id: string }) =>
        allowedVendorIdsSearch.has(String(v.id))
      );

      // If serviceStyle is 'at_home' or 'tele', also return staff
      let staff: any[] = [];
      if (serviceStyle && ['at_home', 'tele'].includes(serviceStyle) && roleId) {
        const staffQuery = `
          SELECT s.*, v.business_name as vendor_name, v.city, v.state
          FROM staff s
          INNER JOIN vendors v ON s.vendor_id = v.id
          INNER JOIN roles r ON v.role_id = r.id
          WHERE s.is_active = true
            AND v.status = 'approved'
            AND v.is_active = true
            AND (LOWER(r.name) = LOWER(executevendorsSearch) OR LOWER(r.display_name) = LOWER(executevendorsSearch))
          LIMIT $2
        `;
        const staffResults = await vendors_searchRepo.dbVendorsSearch6(staffQuery)
        staff = staffResults.rows.map((s: any) => ({
          ...s,
          id: s.id,
          vendorId: s.vendor_id,
          name: s.name,
          rating: s.rating || 0,
        }));
      }

      return c.json({
        success: true,
        vendors: filteredEnrichedVendors,
        staff: staff.length > 0 ? staff : undefined,
        total: filteredEnrichedVendors.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error in /customer/vendors/search:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to search vendors',
        vendors: [],
        total: 0
      }, 500);
    }
}
