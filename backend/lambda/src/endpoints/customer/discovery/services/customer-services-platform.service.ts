import type { Context } from 'hono';
import * as customer_services_platformRepo from '../repos/customer-services-platform.repo';
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
} from '../repos/legacy-helpers.repo';

export async function executecustomerServicesPlatform(c: Context) {

    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const category = c.req.query('category');

      if (!roleId) {
        return c.json({
          success: false,
          error: 'roleId is required',
        }, 400);
      }

      // ✅ Check if service_catalog table exists
      const tableCheck = await customer_services_platformRepo.dbCustomerServicesPlatform0(information_schema).catch(() => ({ rows: [{ exists: false }] }));

      if (!tableCheck.rows[0]?.exists) {
        // Return fallback services from vendor_services if service_catalog doesn't exist
        console.log('[Platform Services] service_catalog table not found, using vendor_services fallback');

        let fallbackQuery = `
          SELECT DISTINCT 
            vs.id,
            vs.service_id,
            vs.service_name,
            vs.service_name as display_name,
            COALESCE(vs.custom_description, (SELECT sc.description FROM service_catalog sc WHERE sc.service_name = vs.service_name AND sc.service_style = vs.service_style LIMIT 1)) as description,
            vs.category as category_name,
            vs.service_style,
            vs.price as base_price,
            vs.duration_minutes
          FROM vendor_services vs
          INNER JOIN vendors v ON vs.vendor_id = v.id
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
            AND (LOWER(r.name) = LOWER(executecustomerServicesPlatform) OR LOWER(r.display_name) = LOWER(executecustomerServicesPlatform))
        `;

        const fallbackParams: any[] = [roleId];
        let paramIdx = 2;

        if (serviceStyle && serviceStyle !== 'all') {
          const acceptableStyles = acceptableStylesForService(serviceStyle);
          fallbackQuery += ` AND vs.service_style = ANY(${paramIdx}::text[])`;
          fallbackParams.push(acceptableStyles);
          paramIdx++;
        }

        fallbackQuery += ` LIMIT 50`;

        const fallbackResult = await customer_services_platformRepo.dbCustomerServicesPlatform1(fallbackQuery, fallbackParams).catch(() => ({ rows: [] }));

        const services = fallbackResult.rows.map((row: any) => ({
          id: row.service_id || row.id,
          serviceId: row.service_id,
          name: row.display_name || row.service_name,
          serviceName: row.service_name,
          displayName: row.display_name,
          description: row.description,
          categoryName: row.category_name,
          serviceStyle: row.service_style,
          basePrice: parseFloat(row.base_price) || 0,
          price: parseFloat(row.base_price) || 0,
          durationMinutes: row.duration_minutes || 30,
          duration: row.duration_minutes || 30,
        }));

        return c.json({
          success: true,
          count: services.length,
          services,
          filters: { roleId, serviceStyle, category },
          _fallback: true,
        });
      }

      // Build query for service_catalog
      let queryText = `
        SELECT 
          id,
          service_id,
          service_name,
          display_name,
          description,
          category_id,
          category_name,
          sub_category_id,
          sub_category_name,
          applicable_roles,
          service_style,
          base_price,
          duration_minutes,
          metadata,
          display_order
        FROM service_catalog
        WHERE status = 'active'
          AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)
          AND executecustomerServicesPlatform = ANY(applicable_roles)
      `;
      const params: any[] = [roleId];
      let paramIndex = 2;

      // Filter by service style
      if (serviceStyle && serviceStyle !== 'all') {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        queryText += ` AND (service_style = ANY(${paramIndex}::text[]) OR service_style = 'all')`;
        params.push(acceptableStyles);
        paramIndex++;
      }

      // Filter by category
      if (category) {
        queryText += ` AND (category_id = ${paramIndex} OR category_name ILIKE ${paramIndex + 1})`;
        params.push(category);
        params.push(`%${category}%`);
        paramIndex += 2;
      }

      queryText += ` ORDER BY display_order ASC, service_name ASC`;

      const result = await customer_services_platformRepo.dbCustomerServicesPlatform2(queryText, params).catch(() => ({ rows: [] }));

      // Format services for frontend consumption
      const services = result.rows.map((row: any) => ({
        id: row.service_id || row.id,
        serviceId: row.service_id,
        name: row.display_name || row.service_name,
        serviceName: row.service_name,
        displayName: row.display_name,
        description: row.description,
        categoryId: row.category_id,
        categoryName: row.category_name,
        subCategoryId: row.sub_category_id,
        subCategoryName: row.sub_category_name,
        serviceStyle: row.service_style,
        basePrice: parseFloat(row.base_price) || 0,
        price: parseFloat(row.base_price) || 0,
        durationMinutes: row.duration_minutes || 30,
        duration: row.duration_minutes || 30,
        metadata: row.metadata,
        displayOrder: row.display_order,
        applicableRoles: row.applicable_roles,
      }));

      console.log(`[Platform Services] Found ${services.length} services for role=${roleId}, style=${serviceStyle}`);

      return c.json({
        success: true,
        count: services.length,
        services,
        filters: {
          roleId,
          serviceStyle,
          category,
        },
      });
    } catch (error: any) {
      console.error('[Platform Services] Error:', error);
      // ✅ Return empty array instead of 500 error
      return c.json({
        success: true,
        count: 0,
        services: [],
        filters: {
          roleId: c.req.query('roleId'),
          serviceStyle: c.req.query('serviceStyle'),
          category: c.req.query('category'),
        },
        _error: error.message,
      });
    }
}
