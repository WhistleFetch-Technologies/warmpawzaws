import type { Context } from 'hono';
import * as vendor_facility_putRepo from '../repos/vendor-facility-put.repo';
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
  parseVendorMetadata,
} from '../repos/legacy-helpers.repo';

export async function executevendorFacilityPut(c: Context) {

    try {
      const { vendorId } = c.req.param();
      const facilityData = await c.req.json();

      // Resolve vendor (frontend may pass vendor_identity.id; data is stored by vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      // ✅ FIX: Build update data object, mapping frontend fields to database columns
      const updateData: any = {};

      // Address fields
      if (facilityData.address !== undefined) updateData.address = facilityData.address;
      if (facilityData.city !== undefined) updateData.city = facilityData.city;
      if (facilityData.state !== undefined) updateData.state = facilityData.state;
      if (facilityData.pincode !== undefined) updateData.pincode = facilityData.pincode;
      if (facilityData.country !== undefined) updateData.country = facilityData.country;

      // Location coordinates
      if (facilityData.latitude !== undefined) updateData.latitude = facilityData.latitude;
      if (facilityData.longitude !== undefined) updateData.longitude = facilityData.longitude;

      // Operating hours (stored as JSONB)
      if (facilityData.operatingHours !== undefined || facilityData.operating_hours !== undefined) {
        updateData.operating_hours = facilityData.operatingHours || facilityData.operating_hours;
      }

      // ✅ FIX: Build metadata object once to avoid overwriting
      const existingMetadata = parseVendorMetadata(vendor.metadata);
      const updatedMetadata: Record<string, unknown> = { ...existingMetadata };
      let metadataChanged = false;

      // Amenities (stored in metadata)
      if (facilityData.amenities !== undefined) {
        updatedMetadata.amenities = facilityData.amenities;
        metadataChanged = true;
      }

      // Custom amenities
      if (facilityData.customAmenities !== undefined) {
        updatedMetadata.customAmenities = facilityData.customAmenities;
        metadataChanged = true;
      }

      // Specializations (stored in metadata + vendors.specializations column + vendor_specializations table for 360° discovery)
      if (facilityData.specializations !== undefined) {
        const specArr = Array.isArray(facilityData.specializations)
          ? facilityData.specializations
          : (typeof facilityData.specializations === 'string' ? [facilityData.specializations] : []);
        updatedMetadata.specializations = specArr;
        metadataChanged = true;
        // Sync to vendors.specializations column so /customer/vendors/discover-by-problem works
        updateData.specializations = specArr;
        // vendor_specializations table will be synced below after vendor update
      }

      // Facility photos (stored in metadata)
      if (facilityData.photos !== undefined || facilityData.facility_photos !== undefined) {
        const photosInput = facilityData.photos || facilityData.facility_photos || [];
        // ✅ FIX: Normalize photos - extract S3 keys from presigned URLs or full URLs
        const normalizedPhotos = photosInput.map((photoItem: string) => {
          if (!photoItem || typeof photoItem !== 'string') {
            return null;
          }

          // If it's already a key (starts with vendors/), return as-is
          if (photoItem.startsWith('vendors/')) {
            return photoItem;
          }

          // If it's a presigned URL or full S3 URL, extract the key
          if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
            // Extract key from full S3 URL
            const urlParts = photoItem.split('.amazonaws.com/');
            if (urlParts.length > 1) {
              return urlParts[1].split('?')[0].split('#')[0];
            }
          } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
            // Extract key from presigned URL
            const urlParts = photoItem.split('?')[0];
            if (urlParts.includes('vendors/')) {
              const vendorsIndex = urlParts.indexOf('vendors/');
              return urlParts.substring(vendorsIndex);
            }
          }

          // If we can't extract a key, return null (invalid photo)
          console.warn(`[FACILITY-SAVE] Could not normalize photo, skipping:`, photoItem);
          return null;
        }).filter((key: string): key is string => key !== null && key.length > 0);

        console.log(`[FACILITY-SAVE] Normalized ${normalizedPhotos.length} photos from ${photosInput.length} input photos`);
        updatedMetadata.facility_photos = normalizedPhotos;
        metadataChanged = true;
        // Business/center: listing avatar follows first gallery image (customer discovery + profile_photo_url consumers).
        if (vendorGalleryDrivesListingPhoto(vendor)) {
          updateData.profile_photo_url = normalizedPhotos.length > 0 ? normalizedPhotos[0] : null;
        }
      }

      // ✅ FIX: Store description in metadata (column doesn't exist in vendors table)
      if (facilityData.description !== undefined) {
        updatedMetadata.description = facilityData.description;
        metadataChanged = true;
      }

      // Store disclaimer/instructions in metadata (editable by vendor from profile basic tab)
      if (facilityData.disclaimerPoints !== undefined || facilityData.disclaimer !== undefined) {
        const disclaimerPointsInput = Array.isArray(facilityData.disclaimerPoints)
          ? facilityData.disclaimerPoints
          : (typeof facilityData.disclaimer === 'string'
            ? String(facilityData.disclaimer).split(/\n+/)
            : []);
        const disclaimerPoints = disclaimerPointsInput
          .map((point: any) => String(point ?? '').trim())
          .filter(Boolean);
        updatedMetadata.disclaimerPoints = disclaimerPoints;
        updatedMetadata.disclaimer = disclaimerPoints.join('\n');
        metadataChanged = true;

        // Dedicated boarding disclaimer columns (per-vendor; customer intake + discovery). Requires migration 722.
        try {
          const roleRows = await vendor_facility_putRepo.dbVendorFacilityPut0(vendor)
          const rn = String(roleRows[0]?.name || '')
            .toLowerCase()
            .replace(/-/g, '_');
          if (getCategoryFromRole(rn) === 'boarding') {
            await vendor_facility_putRepo.dbVendorFacilityPut1(actualVendorId, jsonb, uuid, disclaimerPoints, JSON)
          }
        } catch (syncBoardingDiscErr: any) {
          console.warn(
            '[FACILITY] boarding_disclaimer column sync failed (apply db/migrations/722_vendor_boarding_disclaimer_columns.sql):',
            syncBoardingDiscErr?.message
          );
        }
      }

      // Update metadata if any metadata fields changed
      if (metadataChanged) {
        // ✅ FIX B1: Check if metadata column exists before trying to update it
        // If column doesn't exist, we'll use a raw SQL query to add it first
        try {
          // Check if metadata column exists
          const { query } = await import('../../../database/rds-connection');
          const columnCheck = await vendor_facility_putRepo.dbVendorFacilityPut2(information_schema)

          if (columnCheck.rows.length === 0) {
            // Column doesn't exist, add it
            console.log('[FACILITY] Metadata column missing, adding it...');
            await vendor_facility_putRepo.dbVendorFacilityPut3()
            console.log('[FACILITY] Metadata column added successfully');
          }

          updateData.metadata = updatedMetadata;
        } catch (metadataError: any) {
          console.error('[FACILITY] Error handling metadata column:', metadataError);
          // If metadata update fails, continue with other fields but log the error
          // Don't fail the entire request if metadata column is missing
          if (!metadataError.message?.includes('does not exist')) {
            throw metadataError;
          }
          // Skip metadata update if column truly doesn't exist
          console.warn('[FACILITY] Skipping metadata update - column may not exist');
        }
      }

      // ✅ FIX: Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one facility field' }, 400);
      }

      // Always update the updated_at timestamp
      updateData.updated_at = new Date().toISOString();

      // Update vendor record with facility information (use resolved vendor id)
      const { update } = await import('../../../database/rds-connection');
      const updated = await vendor_facility_putRepo.dbVendorFacilityPut4(actualVendorId, updateData)

      if (updated.length === 0) {
        return c.json({ error: 'Failed to update facility' }, 500);
      }

      // 360°: Sync specializations to vendor_specializations table so /customer/services/by-problem and /customer/vendors/by-problem discover correctly
      const specArr = facilityData.specializations !== undefined
        ? (Array.isArray(facilityData.specializations) ? facilityData.specializations : (typeof facilityData.specializations === 'string' ? [facilityData.specializations] : []))
        : null;
      if (specArr !== null) {
        try {
          await vendor_facility_putRepo.dbVendorFacilityPut5()
          for (const spec of specArr) {
            const s = typeof spec === 'string' ? spec.trim() : (spec?.id ?? spec?.specializationId ?? String(spec));
            if (s) {
              await vendor_facility_putRepo.dbVendorFacilityPut6(actualVendorId, s)
            }
          }
        } catch (syncErr: any) {
          console.warn('[FACILITY] vendor_specializations sync failed (non-fatal):', syncErr?.message);
        }
      }

      return c.json({
        success: true,
        message: 'Facility updated successfully',
        facility: {
          address: updated[0].address,
          city: updated[0].city,
          state: updated[0].state,
          pincode: updated[0].pincode,
          latitude: updated[0].latitude,
          longitude: updated[0].longitude,
          operating_hours: updated[0].operating_hours,
          disclaimer: (updated[0].metadata as any)?.disclaimer,
          disclaimerPoints: (updated[0].metadata as any)?.disclaimerPoints || [],
          amenities: (updated[0].metadata as any)?.amenities || [],
          photos: (updated[0].metadata as any)?.facility_photos || [],
          specializations: (updated[0].metadata as any)?.specializations ?? (updated[0].specializations ?? []),
        },
      });
    } catch (error: any) {
      console.error('Error updating vendor facility:', error);
      return c.json({ error: error.message || 'Failed to update facility' }, 500);
    }
}
