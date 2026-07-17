import type { Context } from 'hono';
import * as debug_training_vendorsRepo from '../repos/debug-training-vendors.repo';
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
  columnExists,
  sqlVendorMatchesDeclaredSpecialization,
} from '../repos/legacy-helpers.repo';

export async function executedebugTrainingVendors(c: Context) {

    try {
      const hasVsCatId = await columnExists('vendor_services', 'category_id');

      // Show all trainer_center / training_center vendors and their at_center services
      const vendorCheck = await debug_training_vendorsRepo.dbDebugTrainingVendors0()

      // Run the by-style EXISTS check for each vendor (full conditions including is_custom)
      const byStyleCheck = await debug_training_vendorsRepo.dbDebugTrainingVendors1()

      // Check specializations for "wrong persona" vendor specifically
      const specCheck = await debug_training_vendorsRepo.dbDebugTrainingVendors2().catch(() => ({ rows: [] }));

      // Check what specialization_master has for basic_obedience
      const masterCheck = await debug_training_vendorsRepo.dbDebugTrainingVendors3().catch(() => ({ rows: [] }));

      // Simulate the exact sqlVendorMatchesDeclaredSpecialization SQL for 'basic_obedience'
      // This is exactly what the by-style endpoint runs when specialization=basic_obedience
      const specKeys = ['basic_obedience', 'basic obedience', 'obedience', 'd9466ca6-2809-45e5-8a40-13443d652e8f'];
      const specIlike = ['%basic\\_obedience%', '%basic obedience%', '%obedience%', '%d9466ca6-2809-45e5-8a40-13443d652e8f%'];
      const specFilterSimulation = await debug_training_vendorsRepo.dbDebugTrainingVendors4(specKeys, specIlike).catch((e: any) => ({ rows: [], error: e?.message }));

      return c.json({
        success: true,
        has_category_id_col: hasVsCatId,
        training_vendors_detail: vendorCheck.rows,
        by_style_check: byStyleCheck.rows,
        specialization_check: specCheck.rows,
        master_check: masterCheck.rows,
        spec_filter_simulation: (specFilterSimulation as any).rows || [],
        spec_filter_error: (specFilterSimulation as any).error || null,
      });
    } catch (error: any) {
      return c.json({ success: false, error: error?.message }, 500);
    }
}
