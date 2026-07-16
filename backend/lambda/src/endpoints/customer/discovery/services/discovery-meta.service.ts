import type { Context } from 'hono';
import * as discovery_metaRepo from '../repos/discovery-meta.repo';
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
  getCategoryFromRole,
} from '../repos/legacy-helpers.repo';

export async function executediscoveryMeta(c: Context) {

    try {
      // Align with admin active vendors: (approved|active), any published/draft service, no r.is_active
      const rolesResult = await discovery_metaRepo.dbDiscoveryMeta0()
      const stylesResult = await discovery_metaRepo.dbDiscoveryMeta1()
      const roles = (rolesResult.rows || []).map((r: any) => ({
        roleId: r.rolename,
        roleName: r.rolename,
        displayName: r.roledisplayname || r.rolename,
        category: getCategoryFromRole(r.rolename || ''),
      }));
      const serviceStyles = (stylesResult.rows || []).map((s: any) => s.servicestyle).filter(Boolean);
      const categories = [...new Set(roles.map((r: any) => r.category).filter(Boolean))].sort();
      return c.json({
        success: true,
        roles,
        serviceStyles: serviceStyles.length ? serviceStyles : ['at_center', 'at_home', 'tele'],
        categories,
      });
    } catch (error: any) {
      console.error('[discovery/meta] Error:', error);
      return c.json({
        success: true,
        roles: [],
        serviceStyles: ['at_center', 'at_home', 'tele'],
        categories: ['vet', 'grooming', 'training', 'walker', 'nutrition', 'boarding', 'diagnostics', 'shop', 'cafes', 'photography', 'insurance', 'ambulance', 'breeder', 'adoption', 'relocation', 'resort', 'holiday', 'sunset'],
      }, 200);
    }
}
