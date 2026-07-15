import type { Hono } from 'hono';
import { select, query, insert } from '../../../../database/rds-connection';
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
  batchLoadVendorSpecializationsForDiscovery,
  parseVendorMetadata,
  presignCustomerFacilityGalleryUrls,
  safeParseOperatingHours,
  vendorAmenitiesFromMetadata,
  vendorRowIsOnline,
} from '../shared/legacy-helpers';

export function registerCustomerFacilityRoute(app: Hono) {
  app.get("/customer/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required' }, 400);
      }

      // Get vendor details
      const vendorResult = await query(
        `SELECT v.*, r.name as role_name, r.display_name as role_display_name,
                r.config as role_config
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.id = $1`,
        [vendorId]
      );

      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      const vendor = vendorResult.rows[0];
      if (!vendorRowIsOnline(vendor.is_online)) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews WHERE vendor_id = $1`,
        [vendorId]
      );

      // Get recent reviews
      const reviewsResult = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1
         ORDER BY r.created_at DESC LIMIT 5`,
        [vendorId]
      );

      // Get staff
      const staffResult = await query(
        `SELECT id, name, role, experience_years, is_active
         FROM staff WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      );

      // ✅ FIX: Extract metadata for description, custom amenities, and photos
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

      const facilitySpecMap = await batchLoadVendorSpecializationsForDiscovery([
        {
          vendor_id: String(vendor.id),
          metadata: vendor.metadata,
          v_specs_jsonb: (vendor as any).specializations,
        },
      ]);
      const facilitySpecializationLabels =
        facilitySpecMap.get(String(vendor.id))?.displayLabels ?? [];

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Ensure pincode is returned
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: metadata.description || vendor.description || '', // ✅ FIX: Get description from metadata
          logoUrl: vendor.logo_url,
          coverImageUrl: vendor.cover_image_url,
          role: vendor.role_name,
          roleDisplayName: vendor.role_display_name,
          /** Presigned headshot / listing photo so customer profile hero matches discover-services cards */
          photoUrl: await getVendorListingPhotoUrl(vendor),
        },
        facility: {
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Include pincode
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          photos: validPhotos, // ✅ FIX: Use presigned URLs generated on-demand
          amenities,
          customAmenities,
          description: metadata.description || vendor.description || '', // ✅ FIX: Include description
          disclaimer: metadata.disclaimer,
          disclaimerPoints: metadata.disclaimerPoints || [],
          operatingHours: operatingHours, // ✅ FIX: Parse operating hours
          specializations:
            facilitySpecializationLabels.length > 0
              ? facilitySpecializationLabels
              : metadata.specializations || [],
        },
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0').toFixed(1),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: reviewsResult.rows.map(r => ({
          id: r.id,
          customerName: r.customer_name || 'Anonymous',
          rating: r.rating,
          comment: r.comment,
          date: r.created_at,
        })),
        staff: staffResult.rows.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          experienceYears: s.experience_years,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching facility:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/clinic/:vendorId/services
   * Get services for a specific clinic/vendor
   */
}
