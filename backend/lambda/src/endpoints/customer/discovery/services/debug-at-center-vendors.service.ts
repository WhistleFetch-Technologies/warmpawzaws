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
      // Stage 3: admin-only operational diagnostic — never dump vendor rows to clients.
      const { isAdminRole } = await import('../../../../utils/security-ownership');
      if (!isAdminRole(c)) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }

      const allVendors = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors0();
      const approvedVendors = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors1();
      const vetVendors = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors2();

      let vetWithAvailability = 0;
      if (vetVendors.rows.length > 0) {
        const vetIds = vetVendors.rows.map((v: { id: string }) => v.id);
        const availabilityResult = await debug_at_center_vendorsRepo.dbDebugAtCenterVendors3(vetIds);
        vetWithAvailability = parseInt(availabilityResult.rows[0]?.c || '0', 10) || 0;
      }

      return c.json({
        success: true,
        summary: {
          all_vendors_with_at_center: parseInt(allVendors.rows[0]?.c || '0', 10) || 0,
          approved_active_non_solo: parseInt(approvedVendors.rows[0]?.c || '0', 10) || 0,
          vet_category: vetVendors.rows.length,
          vet_with_availability: vetWithAvailability,
        },
        message: 'Diagnostic summary only; vendor records are not exposed',
      });
    } catch (error: any) {
      const { captureException } = await import('../../../../utils/error-tracking');
      const { SAFE_INTERNAL_ERROR_MESSAGE } = await import('../../../../utils/safe-hono-error');
      captureException(error instanceof Error ? error : new Error(String(error)), {
        path: c.req.path,
        method: c.req.method,
      });
      return c.json({
        success: false,
        error: SAFE_INTERNAL_ERROR_MESSAGE,
      }, 500);
    }
}
