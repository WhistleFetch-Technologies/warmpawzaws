import type { Context } from 'hono';
import * as debug_at_center_vendorsRepo from '../repos/debug-at-center-vendors.repo';
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

export async function executedebugAtCenterVendors(c: Context) {

    try {
      const category = c.req.query('category') || 'vet';

      // Query 1: All vendors with at_center services
      const allVendors = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors0()

      // Query 2: Approved/active vendors with at_center services (non-solo)
      const approvedVendors = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors1()

      // Query 3: Vet category vendors with at_center services
      const vetVendors = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors2()

      // Query 4: Check availability for vet vendors
      let vetAvailability = [];
      if (vetVendors.rows.length > 0) {
        const vetIds = vetVendors.rows.map((v: any) => v.id);
        const availabilityResult = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors3(vetIds)
        vetAvailability = availabilityResult.rows;
      }

      return c.json({
        success: true,
        summary: {
          all_vendors_with_at_center: allVendors.rows.length,
          approved_active_non_solo: approvedVendors.rows.length,
          vet_category: vetVendors.rows.length,
          vet_with_availability: vetAvailability.length
        },
        all_vendors: allVendors.rows,
        approved_vendors: approvedVendors.rows,
        vet_vendors: vetVendors.rows,
        vet_availability: vetAvailability
      });
    } catch (error: any) {
      console.error('[debug/at-center-vendors] Error:', error);
      return c.json({
        success: false,
        error: error.message,
        stack: error.stack
      }, 500);
    }
}
