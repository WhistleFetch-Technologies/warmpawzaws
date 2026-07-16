import type { Context } from 'hono';
import * as customer_servicesRepo from '../repos/customer-services.repo';
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
  acceptableStylesForService,
  resolveTargetRolesForDiscovery,
} from '../repos/legacy-helpers.repo';

export async function executecustomerServices(c: Context) {

    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');

      // Build vendor query: same eligibility as by-style (geocode optional; distance is cosmetic without coords)
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
          AND EXISTS (
            SELECT 1 FROM vendor_services vs 
            WHERE vs.vendor_id = v.id 
              AND vs.is_enabled = true 
              AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
          )
          AND ${sqlVendorAvailabilityOrNotConfigured('v')}
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // DB-driven: filter by category and/or roleId (only discoverable roles)
      const targetRoles = await resolveTargetRolesForDiscovery(category || null, roleId || null);
      if (targetRoles.length > 0) {
        vendorQuery += ` AND r.name = ANY(${paramIndex}::text[])`;
        params.push(targetRoles);
        paramIndex++;
      }

      // Get vendors
      const vendors = await customer_servicesRepo.dbCustomerServices0(vendorQuery, params)

      // Get services for each vendor: base on vendor_services so catalog-origin services appear (vs.service_id can point to services.id or service_catalog.id)
      const services = await Promise.all(
        vendors.rows.map(async (vendor: any) => {
          const params: any[] = [vendor.id];
          let styleClause = '';
          if (serviceStyle) {
            const acceptableStyles = acceptableStylesForService(serviceStyle);
            params.push(acceptableStyles);
            styleClause = ` AND vs.service_style = ANY(${params.length}::text[])`;
          }
          const vendorServices = await customer_servicesRepo.dbCustomerServices1(styleClause, params)

          return vendorServices.rows.map((row: any) => ({
            id: row.vs_id,
            serviceId: row.service_id,
            serviceName: row.vs_service_name || row.sc_service_name || row.s_name || 'Service',
            vendorId: vendor.id,
            vendorName: vendor.business_name,
            price: row.custom_price != null ? parseFloat(row.custom_price) : (row.sc_price != null ? parseFloat(row.sc_price) : (row.s_price != null ? parseFloat(row.s_price) : 0)),
            duration: row.custom_duration ?? row.sc_duration ?? row.s_duration ?? 30,
            serviceStyle: row.service_style || serviceStyle,
          }));
        })
      );

      return c.json({
        success: true,
        services: services.flat(),
      });
    } catch (error: any) {
      console.error('Error fetching customer services:', error);
      return c.json({ error: error.message }, 500);
    }
}
