import type { Context } from 'hono';
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
  countDiscoverableVendorsForDiscoveryQuery,
  getCustomerCoordinates,
} from '../repos/legacy-helpers.repo';

export async function executediscoveryCount(c: Context) {

    try {
      const serviceStyle = c.req.query('serviceStyle') || c.req.query('style');
      if (!serviceStyle) {
        return c.json(
          { success: false, error: 'Service style is required (tele, at_home, at_center)', count: 0 },
          400
        );
      }
      const category = c.req.query('category') || undefined;
      const roleId = c.req.query('roleId') || undefined;
      let latitude = c.req.query('latitude') || null;
      let longitude = c.req.query('longitude') || null;
      if (!latitude || !longitude) {
        const customerPhone = c.req.query('customerPhone') || c.req.query('phone') || null;
        const coords = await getCustomerCoordinates(customerPhone || undefined);
        if (coords) {
          latitude = String(coords.latitude);
          longitude = String(coords.longitude);
        }
      }
      const count = await countDiscoverableVendorsForDiscoveryQuery({
        serviceStyleRaw: serviceStyle,
        category,
        roleId,
        latitude,
        longitude,
        radiusQ: c.req.query('radius') || undefined,
        maxDistanceQ: c.req.query('maxDistance') || undefined,
        minRatingQ: c.req.query('minRating') || undefined,
        specialization:
          (c.req.query('specialization') || c.req.query('specializationId') || '').trim() || undefined,
      });
      return c.json({ success: true, count });
    } catch (error: any) {
      console.error('[discovery/count] Error:', error);
      return c.json({ success: false, error: error?.message || 'Count failed', count: 0 }, 500);
    }
}
