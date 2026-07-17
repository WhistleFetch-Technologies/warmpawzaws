import type { Context } from 'hono';
import * as vendor_facility_getRepo from '../repos/vendor-facility-get.repo';
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
  parseVendorMetadata,
  presignCustomerFacilityGalleryUrls,
  resolveBoardingDisclaimerFromVendor,
  safeParseOperatingHours,
  vendorAmenitiesFromMetadata,
} from '../repos/legacy-helpers.repo';

export async function executevendorFacilityGet(c: Context) {

    try {
      const { vendorId } = c.req.param();

      // Resolve vendor (frontend may pass vendor_identity.id; data is stored by vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get services
      // Check if is_global column exists
      const serviceColumns = await vendor_facility_getRepo.dbVendorFacilityGet0()
      const hasIsGlobal = serviceColumns.rows.length > 0;

      const services = await vendor_facility_getRepo.dbVendorFacilityGet1(hasIsGlobal, vendor)

      // Get rating
      const ratingResult = await vendor_facility_getRepo.dbVendorFacilityGet2(vendor)

      // Get recent reviews
      const recentReviews = await vendor_facility_getRepo.dbVendorFacilityGet3(vendor)

      // ✅ FIX: Extract facility data from vendor metadata and operating_hours
      const metadata = parseVendorMetadata(vendor.metadata);
      const { amenities, customAmenities } = vendorAmenitiesFromMetadata(metadata, vendor);
      const operatingHours = safeParseOperatingHours(vendor.operating_hours);

      const rawMixed = metadata.facility_photos || metadata.photos || [];
      const rawCount = Array.isArray(rawMixed) ? rawMixed.length : 0;
      console.log(`[FACILITY-PHOTOS] Found ${rawCount} photos in metadata for vendor ${vendor.id}`);

      const validPhotos = await presignCustomerFacilityGalleryUrls(
        vendor.id,
        Array.isArray(rawMixed) ? rawMixed : []
      );
      console.log(`[FACILITY-PHOTOS] Returning ${validPhotos.length} valid photos out of ${rawCount} total`);

      const boardingDisc = resolveBoardingDisclaimerFromVendor(vendor, metadata);
      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          business_name: vendor.business_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          phone: vendor.phone,
          email: vendor.email,
          /** Same as discovery /customer/vendor — solo providers often only have profile photo, not facility_photos */
          photoUrl: await getVendorListingPhotoUrl(vendor),
          roleId: vendor.role_id, // ✅ FIX: Include roleId for CenterProfileManager
          role_id: vendor.role_id,
          boardingDisclaimer: boardingDisc.disclaimer,
          boardingDisclaimerPoints: boardingDisc.disclaimerPoints,
          amenities,
          customAmenities,
        },
        facility: {
          centerName: vendor.business_name, // ✅ FIX: Include centerName
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Ensure pincode is returned
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: metadata.description || vendor.description || '', // ✅ FIX: Get description from metadata
          disclaimer: boardingDisc.disclaimer || metadata.disclaimer,
          disclaimerPoints: boardingDisc.disclaimerPoints.length ? boardingDisc.disclaimerPoints : metadata.disclaimerPoints || [],
          amenities,
          customAmenities,
          photos: validPhotos, // ✅ FIX: Use presigned URLs generated on-demand
          specializations: metadata.specializations || [],
          operatingHours: operatingHours || null,
          roleId: vendor.role_id, // ✅ FIX: Include roleId for SpecializationSelector
        },
        services: services.rows || [],
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0'),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: recentReviews.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor facility:', error);
      return c.json({ error: error.message }, 500);
    }
}
