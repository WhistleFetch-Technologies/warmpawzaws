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
  acceptableStylesForService,
  columnExists,
  parseVendorServiceMetadataForCustomer,
  resolveCustomerIdFromPhone,
  vendorRowIsOnline,
  vendorServicePackagePresentationForCustomer,
} from '../shared/legacy-helpers';

export function registerVendorServicesRoute(app: Hono) {
  app.get("/customer/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const category = c.req.query('category');
      // Check multiple possible parameter names for serviceStyle
      const serviceStyle = c.req.query('serviceStyle') || c.req.query('service_style') || c.req.query('style');
      const customerPhone = c.req.query('customerPhone') || c.req.query('phone');

      console.log(`[Vendor Services] Request params: vendorId=${vendorId}, category=${category}, serviceStyle=${serviceStyle}, customerPhone=${customerPhone}`);
      console.log(`[Vendor Services] All query params:`, Object.keys(c.req.query()).reduce((acc, key) => {
        acc[key] = c.req.query(key);
        return acc;
      }, {} as Record<string, string | undefined>));

      // Resolve vendor (frontend may pass vendor_identity.id or staff id; resolve to vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }
      if (!vendorRowIsOnline(vendor.is_online)) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Included vendor_service ids (and legacy service_ids) from customer's active packages (for "In your package" label)
      const includedVendorServiceIds = new Set<string>();
      const includedLegacyServiceIds = new Set<string>();
      const vendorServiceIdToPackagePurchaseId = new Map<string, string>();
      if (customerPhone) {
        try {
          const customerId = await resolveCustomerIdFromPhone(customerPhone);
          if (customerId) {
            await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, {
              customerId,
              vendorId: resolvedVendorId,
            });
            const purchases = await query(
              `SELECT id, package_id, package_snapshot FROM package_purchases
               WHERE customer_id = $1 AND vendor_id = $2 AND status = 'active'
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND (${sqlPackagePurchaseActiveForListing('package_purchases')})`,
              [customerId, resolvedVendorId]
            );
            for (const pp of purchases.rows || []) {
              const snapshot = pp.package_snapshot && (typeof pp.package_snapshot === 'string' ? JSON.parse(pp.package_snapshot) : pp.package_snapshot);
              const inc = snapshot?.includedServices;
              if (Array.isArray(inc) && inc.length > 0) {
                inc.forEach((s: any) => {
                  const id = s.id || s.vendor_service_id;
                  if (id) {
                    includedVendorServiceIds.add(id);
                    vendorServiceIdToPackagePurchaseId.set(id, pp.id);
                  }
                });
              } else {
                const vsRow = await query(
                  `SELECT id, metadata FROM vendor_services WHERE id = $1 AND vendor_id = $2`,
                  [pp.package_id, resolvedVendorId]
                );
                if (vsRow.rows?.length > 0) {
                  const meta = vsRow.rows[0].metadata;
                  const parsed = typeof meta === 'string' ? (meta ? JSON.parse(meta) : {}) : (meta || {});
                  const details = parsed?.packageDetails || parsed;
                  const arr = details?.includedServices || details?.included_services;
                  if (Array.isArray(arr)) {
                    arr.forEach((s: any) => {
                      const id = s.id || s.vendor_service_id;
                      if (id) {
                        includedVendorServiceIds.add(id);
                        vendorServiceIdToPackagePurchaseId.set(id, pp.id);
                      }
                    });
                  }
                } else {
                  const psRows = await query(
                    `SELECT service_id FROM package_services WHERE package_id = $1`,
                    [pp.package_id]
                  );
                  for (const r of psRows.rows || []) {
                    if (r.service_id) {
                      includedLegacyServiceIds.add(r.service_id);
                    }
                  }
                }
              }
            }
          }
        } catch (_) { }
      }

      // vendor_services.service_id can point to services.id (legacy) OR service_catalog.id (catalog-origin)
      let servicesQuery = `
        SELECT
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.service_style,
          vs.price,
          vs.custom_price,
          vs.duration_minutes,
          vs.custom_duration,
          vs.custom_description,
          vs.category,
          vs.sub_category,
          vs.metadata as vs_metadata,
          vs.publish_status,
          s.name as base_name,
          s.description as base_description,
          sc.service_name as catalog_name,
          sc.display_name as catalog_display_name,
          sc.description as catalog_description,
          sc.specialization_ids as catalog_specialization_ids,
          sc.category_id as catalog_category_id,
          sc.category_name as catalog_category_name,
          sc.service_id as catalog_service_id,
          COALESCE(sc.category_name, vs.category) as resolved_category
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        LEFT JOIN service_catalog sc ON vs.service_id = sc.id
        WHERE vs.vendor_id = $1
          AND (vs.is_enabled = true OR vs.is_enabled IS NULL)
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `;
      const queryParams: any[] = [resolvedVendorId];

      if (category) {
        const catLower = String(category).toLowerCase().trim().replace(/-/g, '_');
        /** Pet sitting booking sends category=sitting; vendor rows often use "General" or "Pet Sitter" (no "sitting" substring). */
        const sittingBookingCategoryRequest =
          catLower === 'sitting' ||
          catLower === 'pet_sitter' ||
          catLower === 'sitter' ||
          catLower === 'sitter_solo' ||
          catLower === 'pet_sitting';
        const boardingBookingCategoryRequest =
          catLower === 'boarding' || catLower === 'pet_boarding';
        /** Training tile: empty `vs.category` may list any training-hub role. */
        const trainingOnlyBookingCategoryRequest =
          catLower === 'training' ||
          catLower === 'pet_training' ||
          catLower === 'dog_training';
        /** Behavioral hub: same aliases as discover-services, but empty/`training` category only for behavior roles. */
        const behaviorBookingCategoryRequest =
          catLower === 'behaviorist' || catLower === 'behaviourist';
        const trainingBookingCategoryRequest =
          trainingOnlyBookingCategoryRequest || behaviorBookingCategoryRequest;

        const hubBind = vendorServicesHubCategoryBindParams(category);
        if (hubBind) {
          queryParams.push(hubBind.exact, hubBind.like);
          const exactP = queryParams.length - 1;
          const likeP = queryParams.length;
          const hubSql = sqlVendorServicesHubCategoryFilter(category, 'vs', exactP, likeP);
          if (hubSql) servicesQuery += hubSql;
          if (isVetHubCategoryRequest(category)) {
            servicesQuery += sqlVetHubExcludeNonVetServices('vs');
          }
        } else if (sittingBookingCategoryRequest) {
          queryParams.push(category);
          const catParam = queryParams.length;
          /** Align with discover-services: catalog-only legacy `boarding` at_home counts as sitting; never all at_home rows for sitters. */
          servicesQuery += ` AND (
            (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')
            OR (
              LOWER(TRIM(COALESCE(vs.category,''))) = 'boarding'
              AND COALESCE(vs.is_custom_service, false) = false
            )
            OR (
              LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%sitt%'
              AND LOWER(TRIM(COALESCE(vs.category, ''))) NOT LIKE '%babysitt%'
            )
            OR (
              COALESCE(vs.is_custom_service, false) = true
              AND LOWER(TRIM(COALESCE(vs.service_name, ''))) LIKE '%sitt%'
              AND LOWER(TRIM(COALESCE(vs.service_name, ''))) NOT LIKE '%babysitt%'
            )
            OR (
              TRIM(COALESCE(vs.category, '')) = ''
              AND COALESCE(vs.is_custom_service, false) = false
              AND EXISTS (
                SELECT 1 FROM vendors v_sit
                LEFT JOIN roles r_sit ON v_sit.role_id = r_sit.id
                WHERE v_sit.id = vs.vendor_id
                  AND LOWER(COALESCE(TRIM(r_sit.name), '')) IN ('pet_sitter','sitter','sitter_solo','pet_sitter_solo','pet_sitter_saas')
              )
            )
          )
          AND NOT (
            LOWER(TRIM(COALESCE(vs.category, ''))) = ANY(ARRAY[
              'walking','walker','dog_walker','dog walking','dog walker','dog_walking',
              'vet','veterinary','veterinarian','vet care','vet_care',
              'grooming','training','diagnostics','behaviourist','nutrition','daycare','transport'
            ]::text[])
            OR (
              LOWER(TRIM(COALESCE(vs.category, ''))) = 'boarding'
              AND COALESCE(vs.is_custom_service, false) = true
            )
          )`;
        } else if (boardingBookingCategoryRequest) {
          queryParams.push(category);
          const catParam = queryParams.length;
          let boardingCatIdOr = '';
          const hasVsCatColBooking = await columnExists('vendor_services', 'category_id');
          if (hasVsCatColBooking) {
            const brSlug = await query(
              `SELECT id::text FROM service_categories
               WHERE COALESCE(is_active, true) = true
                 AND (
                   LOWER(TRIM(category_id)) = ANY($1::text[])
                   OR LOWER(TRIM(name)) = ANY($1::text[])
                 )`,
              [['boarding', 'pet_boarding', 'pet boarding']]
            ).catch(() => ({ rows: [] as { id: string }[] }));
            const bids = (brSlug.rows || []).map((r: any) => r?.id).filter(Boolean);
            const UUID_RE_B =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const bclean = bids.filter((id: string) => UUID_RE_B.test(String(id).trim()));
            if (bclean.length > 0) {
              const uuidListB = bclean.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
              boardingCatIdOr = `
            OR (
              COALESCE(vs.is_custom_service, false) = true
              AND vs.category_id IS NOT NULL
              AND vs.category_id = ANY(ARRAY[${uuidListB}]::uuid[])
            )`;
            }
          }
          servicesQuery += ` AND (
            (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')
            ${boardingCatIdOr}
          )`;
        } else if (trainingBookingCategoryRequest) {
          queryParams.push(category);
          const catParam = queryParams.length;
          const emptyCatRoleSqlList = behaviorBookingCategoryRequest
            ? BEHAVIOR_HUB_ROLE_SQL_IN_LIST
            : TRAINING_HUB_ROLE_SQL_IN_LIST;
          const trainingLabeledServicesForBehaviorOnly =
            behaviorBookingCategoryRequest && !trainingOnlyBookingCategoryRequest
              ? ` OR (
              LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'
              AND EXISTS (
                SELECT 1 FROM vendors v_tr
                LEFT JOIN roles r_tr ON v_tr.role_id = r_tr.id
                WHERE v_tr.id = vs.vendor_id
                  AND LOWER(COALESCE(TRIM(r_tr.name), '')) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST})
              )
            )`
              : '';
          servicesQuery += ` AND (
            (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')
            OR ${sqlTrainingCategoryAliasOrVs('vs')}
            OR (
              TRIM(COALESCE(vs.category, '')) = ''
              AND EXISTS (
                SELECT 1 FROM vendors v_tr
                LEFT JOIN roles r_tr ON v_tr.role_id = r_tr.id
                WHERE v_tr.id = vs.vendor_id
                  AND LOWER(COALESCE(TRIM(r_tr.name), '')) IN (${emptyCatRoleSqlList})
              )
            )
            ${trainingLabeledServicesForBehaviorOnly}
          )`;
        } else {
          queryParams.push(category);
          const catParam = queryParams.length;
          servicesQuery += ` AND (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')`;
        }
      }
      if (serviceStyle && serviceStyle !== 'all') {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        queryParams.push(acceptableStyles);
        servicesQuery += ` AND vs.service_style = ANY($${queryParams.length}::text[])`;
        console.log(`[Vendor Services] SQL filter: serviceStyle=${serviceStyle}, acceptableStyles=${JSON.stringify(acceptableStyles)}`);
      }

      servicesQuery += ` ORDER BY vs.category, vs.service_name`;

      console.log(`[Vendor Services] SQL query: ${servicesQuery.substring(0, 500)}...`);
      const result = await query(servicesQuery, queryParams);
      console.log(`[Vendor Services] SQL result: ${result.rows.length} services from database`);

      const formattedServices = result.rows.map((row: any) => {
        const price = row.custom_price != null ? parseFloat(row.custom_price) : (row.price != null ? parseFloat(row.price) : 0);
        const duration = row.custom_duration ?? row.duration_minutes ?? 30;
        const name = row.service_name || row.base_name || row.catalog_name || row.catalog_display_name || 'Service';
        const description = row.custom_description || row.base_description || row.catalog_description || '';
        const shortDescription = description.length > 200 ? description.slice(0, 200) + '…' : description;
        const rawSpec = row.catalog_specialization_ids;
        const specializationIds = Array.isArray(rawSpec) ? rawSpec : (rawSpec != null ? [].concat(rawSpec) : []);
        const metadata = parseVendorServiceMetadataForCustomer(row.vs_metadata);
        const { isPackage, packageDetails } = vendorServicePackagePresentationForCustomer(metadata, duration);
        const taxCategoryId = metadata?.taxCategoryId ?? metadata?.tax_category ?? null;
        const couponEligible = metadata?.couponEligible !== false;
        const inActivePackage = includedVendorServiceIds.has(row.id) || includedLegacyServiceIds.has(row.service_id);
        const activePackagePurchaseId = vendorServiceIdToPackagePurchaseId.get(row.id) || undefined;
        return {
          id: row.id,
          serviceId: row.service_id,
          service_id: row.service_id,
          name,
          service_name: name,
          shortDescription,
          longDescription: description || null,
          description,
          durationMinutes: duration,
          base_price: row.price != null ? parseFloat(row.price) : 0,
          price,
          custom_price: row.custom_price != null ? parseFloat(row.custom_price) : undefined,
          duration,
          category: row.resolved_category || row.category,
          categoryName: row.resolved_category || row.category,
          categorySlug: row.category,
          catalogCategoryId: row.catalog_category_id ?? null,
          catalogServiceId: row.catalog_service_id ?? null,
          serviceStyle: row.service_style || null, // Don't default to 'at_center' - use actual value from DB
          specializationIds,
          specialization_ids: specializationIds,
          metadata,
          isPackage,
          packageDetails,
          taxCategoryId,
          couponEligible,
          publishStatus: row.publish_status || 'published',
          isEnabled: true,
          requiresPetProfile: false,
          requiresAddress: false,
          inActivePackage: !!inActivePackage,
          activePackagePurchaseId: inActivePackage ? activePackagePurchaseId : undefined,
        };
      });

      let combined = formattedServices;
      const hasActivePackageForVendor = includedVendorServiceIds.size > 0 || includedLegacyServiceIds.size > 0;

      // ✅ Filter by serviceStyle on the full list (packages + one-offs) so custom packages are not dropped.
      if (serviceStyle && serviceStyle !== 'all') {
        const acceptableStyles = acceptableStylesForService(serviceStyle);

        console.log(`[Vendor Services] Before filter: ${combined.length} rows`);
        console.log(`[Vendor Services] Filtering by serviceStyle=${serviceStyle}, acceptableStyles=${JSON.stringify(acceptableStyles)}`);

        const serviceStylesBefore = combined.map((s: any) => ({
          id: s.id,
          name: s.name,
          style: s.serviceStyle || s.service_style
        }));
        console.log(`[Vendor Services] Service styles before filter:`, serviceStylesBefore);

        combined = combined.filter((s: any) => {
          const style = s.serviceStyle || s.service_style;
          const matches = acceptableStyles.includes(style);
          if (!matches) {
            console.log(`[Vendor Services] Filtering out service: ${s.name} (style: ${style}, not in ${JSON.stringify(acceptableStyles)})`);
          }
          return matches;
        });

        console.log(`[Vendor Services] After filter: ${combined.length} rows`);
        const serviceStylesAfter = combined.map((s: any) => ({
          id: s.id,
          name: s.name,
          style: s.serviceStyle || s.service_style
        }));
        console.log(`[Vendor Services] Service styles after filter:`, serviceStylesAfter);
      }

      const packages = combined.filter((s: any) => s.isPackage);
      const services = combined;

      return c.json({
        success: true,
        services,
        packages,
        count: combined.length,
        hasActivePackage: hasActivePackageForVendor,
      });

    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to fetch services',
        services: []
      }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId
   * Get detailed vendor profile with all services
   * ✅ FIX: Must be registered AFTER /customer/vendor/:vendorId/available-slots to avoid route conflict
   */
  /**
   * GET /public/vendor/:vendorId/profile
   * Guest-safe vendor profile for share links (no auth).
   */
}
