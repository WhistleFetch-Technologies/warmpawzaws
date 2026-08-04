import type { Context } from 'hono';
import * as vendor_facility_uploadRepo from '../repos/vendor-facility-upload.repo';
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
  presignCustomerFacilityGalleryUrls,
} from '../repos/legacy-helpers.repo';

export async function executevendorFacilityUpload(c: Context) {

    try {
      const { vendorId } = c.req.param();

      console.log(`📸 [FACILITY-PHOTOS] Uploading photos for vendor: ${vendorId}`);

      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      type IncomingPhoto = { buffer: Uint8Array; name: string; contentType: string };
      const incoming: IncomingPhoto[] = [];
      const skippedReasons: string[] = [];
      const MAX_BYTES = 25 * 1024 * 1024;

      const requestContentType = (c.req.header('content-type') || '').toLowerCase();
      let attemptedCount = 0;

      if (requestContentType.includes('application/json')) {
        console.log(`📸 [FACILITY-PHOTOS] Parsing JSON/base64 body`);
        const body = await c.req.json();
        const items = Array.isArray(body?.photos) ? body.photos : [];
        attemptedCount = items.length;
        if (items.length === 0) {
          return c.json({ error: 'No photos provided' }, 400);
        }
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          try {
            const raw =
              typeof item?.base64 === 'string'
                ? item.base64
                : typeof item?.data === 'string'
                  ? item.data
                  : null;
            if (!raw) {
              skippedReasons.push(`photo[${i}]: missing base64`);
              continue;
            }
            let base64String = raw.trim();
            let contentType =
              typeof item?.mimeType === 'string'
                ? item.mimeType
                : typeof item?.contentType === 'string'
                  ? item.contentType
                  : 'image/jpeg';
            if (base64String.includes(',')) {
              const parts = base64String.split(',');
              base64String = parts[parts.length - 1] || '';
              const mimeMatch = parts[0].match(/data:([^;]+);/i);
              if (mimeMatch) contentType = mimeMatch[1];
            }
            const buf = Buffer.from(base64String, 'base64');
            if (buf.length === 0) {
              skippedReasons.push(`photo[${i}]: decoded 0 bytes`);
              continue;
            }
            if (buf.length > MAX_BYTES) {
              skippedReasons.push(`photo[${i}]: exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)}MB`);
              continue;
            }
            const name =
              typeof item?.fileName === 'string' && item.fileName
                ? item.fileName
                : `photo-${Date.now()}.jpg`;
            incoming.push({ buffer: new Uint8Array(buf), name, contentType });
          } catch (parseErr: any) {
            skippedReasons.push(`photo[${i}]: ${parseErr?.message || parseErr}`);
          }
        }
      } else {
        console.log(`📸 [FACILITY-PHOTOS] Parsing multipart form`);
        const formData = await c.req.formData();
        const photos = formData.getAll('photos') as File[];
        attemptedCount = photos?.length || 0;
        if (!photos || photos.length === 0) {
          return c.json({ error: 'No photos provided' }, 400);
        }
        for (const photo of photos) {
          try {
            const size = typeof (photo as any)?.size === 'number' ? (photo as any).size : 0;
            if (!size) {
              skippedReasons.push(`${photo.name || 'unnamed'}: 0 bytes (empty upload skipped)`);
              continue;
            }
            const arrayBuffer = await photo.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            if (uint8Array.byteLength === 0) {
              skippedReasons.push(`${photo.name || 'unnamed'}: empty body after arrayBuffer()`);
              continue;
            }
            if (uint8Array.byteLength > MAX_BYTES) {
              skippedReasons.push(`${photo.name || 'unnamed'}: exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)}MB`);
              continue;
            }
            incoming.push({
              buffer: uint8Array,
              name: photo.name || `photo-${Date.now()}.jpg`,
              contentType: photo.type || 'image/jpeg',
            });
          } catch (photoError: any) {
            skippedReasons.push(`${photo.name || 'unnamed'}: ${photoError?.message || photoError}`);
          }
        }
      }

      const existingMetadata = (vendor.metadata as any) || {};
      const existingPhotos: string[] = existingMetadata.facility_photos || [];
      if (existingPhotos.length >= FACILITY_MAX_PHOTOS) {
        return c.json(
          { error: `Maximum ${FACILITY_MAX_PHOTOS} facility photos allowed` },
          400,
        );
      }
      const slotsRemaining = FACILITY_MAX_PHOTOS - existingPhotos.length;
      if (incoming.length > slotsRemaining) {
        return c.json(
          {
            error: `Can upload at most ${slotsRemaining} more photo(s) (limit ${FACILITY_MAX_PHOTOS} total)`,
          },
          400,
        );
      }

      console.log(`📸 [FACILITY-PHOTOS] Processing ${incoming.length} photo(s) (${attemptedCount} attempted)`);

      const photoUrls: string[] = [];

      for (const photo of incoming) {
        try {
          const asset = await uploadDisplayImage({
            buffer: Buffer.from(photo.buffer),
            declaredContentType: photo.contentType,
            assetType: 'facility',
            ownerId: actualVendorId,
            vendorId: actualVendorId,
          });
          photoUrls.push(asset.imageKey);
          console.log(`📸 [FACILITY-PHOTOS] Uploaded WebP: ${asset.imageKey}`);
        } catch (photoError: any) {
          const reason = `${photo.name || 'unnamed'}: ${photoError?.message || photoError}`;
          console.error(`❌ [FACILITY-PHOTOS] Error processing photo ${photo.name}:`, photoError);
          skippedReasons.push(reason);
        }
      }

      if (photoUrls.length === 0) {
        console.warn(
          `⚠️ [FACILITY-PHOTOS] No photos uploaded for vendor ${actualVendorId} (attempted=${attemptedCount}, skipped=${skippedReasons.length})`
        );
        return c.json(
          {
            success: false,
            error:
              'No photos were saved. The selected file(s) appeared empty or could not be processed. Please re-pick the photos and try again.',
            uploadedCount: 0,
            attemptedCount,
            skipped: skippedReasons,
          },
          400
        );
      }

      const allPhotos = [...existingPhotos, ...photoUrls];

      const vendorPatch: Record<string, unknown> = {
        metadata: { ...existingMetadata, facility_photos: allPhotos },
        updated_at: new Date().toISOString(),
      };
      if (vendorGalleryDrivesListingPhoto(vendor)) {
        vendorPatch.profile_photo_url = allPhotos.length > 0 ? allPhotos[0] : null;
      }
      await vendor_facility_uploadRepo.dbVendorFacilityUpload0(actualVendorId, vendorPatch)

      console.log(`✅ [FACILITY-PHOTOS] Uploaded ${photoUrls.length} photos for vendor ${actualVendorId}`);

      const displayUrls = await presignCustomerFacilityGalleryUrls(actualVendorId, photoUrls);

      return c.json({
        success: true,
        photoUrls,
        displayUrls,
        vendorId: actualVendorId,
        totalPhotos: allPhotos.length,
        uploadedCount: photoUrls.length,
        attemptedCount,
        skipped: skippedReasons,
      });
    } catch (error: any) {
      console.error('Error uploading facility photos:', error);
      return c.json({ error: error.message || 'Failed to upload photos' }, 500);
    }
}
