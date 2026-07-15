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


export function registerDebugAtCenterVendorsRoute(app: Hono) {
  app.get('/customer/debug/at-center-vendors', async (c) => {
    try {
      const category = c.req.query('category') || 'vet';

      // Query 1: All vendors with at_center services
      const allVendors = await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);

      // Query 2: Approved/active vendors with at_center services (non-solo)
      const approvedVendors = await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);

      // Query 3: Vet category vendors with at_center services
      const vetVendors = await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) IN ('vet_clinic', 'veterinarian', 'vet')
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);

      // Query 4: Check availability for vet vendors
      let vetAvailability = [];
      if (vetVendors.rows.length > 0) {
        const vetIds = vetVendors.rows.map((v: any) => v.id);
        const availabilityResult = await query(`
          SELECT 
            va.vendor_id,
            v.business_name,
            COUNT(va.id) as availability_slots,
            COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['at_center', 'at_vendor', 'at_clinic']::text[] THEN 1 END) as matching_slots,
            COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) = ARRAY[]::text[] THEN 1 END) as empty_service_styles_slots
          FROM vendor_availability_v2 va
          INNER JOIN vendors v ON va.vendor_id = v.id
          WHERE va.vendor_id = ANY($1::uuid[])
            AND (va.is_available IS NULL OR va.is_available = true)
          GROUP BY va.vendor_id, v.business_name
        `, [vetIds]);
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
  });

  /**
   * GET /customer/services
   * Get customer services list (alias for discover-services)
   */
}
