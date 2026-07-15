import type { Context } from 'hono';
import * as radar_providersRepo from '../repos/radar-providers.repo';
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

export async function executeradarProviders(c: Context) {

    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const roleId = c.req.query('roleId');
      const rules = await getDiscoveryRules(roleId || 'all', 'discover');
      const defaultRadiusKm = rules.discovery_radius_km ?? 10;
      const maxResults = typeof rules.discovery_max_results === 'number' ? rules.discovery_max_results : 50;
      const radius = c.req.query('radius') ? parseFloat(c.req.query('radius')!) : defaultRadiusKm;
      const serviceType = c.req.query('serviceType') || '';

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng are required' }, 400);
      }

      const limitCount = Math.min(100, maxResults);
      // Get vendors with location within radius (rule-book radius + max_results)
      const vendors = await radar_providersRepo.dbRadarProviders0(lat, lng, serviceType, radius, limitCount);

      return c.json({
        success: true,
        providers: vendors.rows.map((v: any) => ({
          id: v.id,
          name: v.business_name,
          role: v.role_name,
          distance: parseFloat(v.distance_km?.toFixed(2) || '0'),
          latitude: v.latitude,
          longitude: v.longitude,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching radar providers:', error);
      return c.json({ error: error.message }, 500);
    }
}
