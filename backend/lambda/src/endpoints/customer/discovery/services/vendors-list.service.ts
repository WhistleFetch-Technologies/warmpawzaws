import type { Context } from 'hono';
import * as vendors_listRepo from '../repos/vendors-list.repo';
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

export async function executevendorsList(c: Context) {

    try {
      const role = c.req.query('role');
      const city = c.req.query('city');
      const status = c.req.query('status') || 'approved';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      let vendorQuery = `
        SELECT 
          v.id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.address,
          v.city,
          v.latitude,
          v.longitude,
          v.status,
          v.role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          (SELECT AVG(rating)::numeric(3,1) FROM reviews WHERE vendor_id = v.id) as avg_rating,
          COALESCE(
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id),
            0
          ) as review_count,
          COALESCE(
            (SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND status = 'completed'),
            0
          ) as completed_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by status
      if (status) {
        vendorQuery += ` AND v.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Filter by role name
      if (role) {
        vendorQuery += ` AND (r.name = $${paramIndex} OR r.display_name ILIKE $${paramIndex + 1})`;
        params.push(role, `%${role}%`);
        paramIndex += 2;
      }

      // Filter by city
      if (city) {
        vendorQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY avg_rating DESC, completed_bookings DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await vendors_listRepo.dbVendorsList0(vendorQuery, params)

      const vendors = result.rows.map((v: any) => {
        const reviewCount = parseInt(v.review_count || '0', 10);
        const avgNum =
          v.avg_rating != null && v.avg_rating !== ''
            ? parseFloat(String(v.avg_rating))
            : NaN;
        const rating =
          reviewCount > 0 && Number.isFinite(avgNum)
            ? parseFloat(avgNum.toFixed(1))
            : null;
        return {
          id: v.id,
          businessName: v.business_name || v.owner_name,
          ownerName: v.owner_name,
          phone: v.phone,
          address: v.address,
          city: v.city,
          latitude: v.latitude,
          longitude: v.longitude,
          status: v.status,
          roleId: v.role_id,
          roleName: v.role_name,
          roleDisplayName: v.role_display_name,
          rating,
          reviewCount,
          completedBookings: parseInt(v.completed_bookings || '0', 10),
        };
      });

      return c.json({
        success: true,
        vendors: vendors,
        total: vendors.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
}
