import type { Context } from 'hono';
import * as services_by_styleRepo from '../repos/services-by-style.repo';
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
  DISCOVERY_LIST_DEFAULT_MAX,
  enrichDiscoveryListVendor,
  enrichDiscoveryListVendorsConcurrent,
} from '../../../../utils/discovery-list-enrich';
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
  batchLoadVendorSpecializationsForDiscovery,
  columnExists,
  deduplicateServices,
  discoveryCustomerRadiusKm,
  getCustomerCoordinates,
  getNextAvailableSlot,
  mapVendorServiceRowForCustomerDiscoveryList,
  normalizeServiceStyle,
  providerWithinRadiusKm,
  resolveSpecializationDiscoveryKeys,
  specializationDiscoveryIlikePatterns,
  sqlVendorMatchesDeclaredSpecialization,
  vendorDistanceSelectColumnsSql,
  vendorHomeServiceRadiusKm,
  vendorRoleIsBehaviorHub,
  vendorRoleIsTrainingHub,
  vendorRowIsOnline,
} from '../repos/legacy-helpers.repo';

export async function executeservicesByStyle(c: Context) {

    try {
      // ────────────────────────────────────────────────────────
      // 1. PARSE & VALIDATE QUERY PARAMETERS
      // ────────────────────────────────────────────────────────
      const serviceStyle = c.req.query('style');
      if (!serviceStyle) {
        return c.json({
          error: 'Service style is required (tele, at_home, at_center)',
          success: false,
        }, 400);
      }

      const serviceStyleNormByStyle = normalizeServiceStyle(serviceStyle) || serviceStyle;

      const category = c.req.query('category');
      const roleId = c.req.query('roleId');
      const problemTitle = c.req.query('problemTitle');
      const specializationFilterByStyle = (
        c.req.query('specialization') ||
        c.req.query('specializationId') ||
        ''
      ).trim();
      /** by-style feeds booking UIs that read provider.services — hydrate by default. Slim only when opted out. */
      const slimByStyle =
        c.req.query('slim') === 'true' || c.req.query('cardsOnly') === 'true';
      const fullEnrichByStyle =
        !slimByStyle ||
        c.req.query('fullEnrich') === 'true' ||
        c.req.query('full') === 'true';
      // Accept lat/lon and latitude/longitude aliases (different parts of the
      // app use different spellings — keep them all working).
      let latitude = c.req.query('latitude') || c.req.query('lat');
      let longitude =
        c.req.query('longitude') || c.req.query('lng') || c.req.query('lon');
      let customerApproximateByStyle = false;
      const customerPhoneForByStyle = c.req.query('customerPhone') || c.req.query('phone') || null;

      // If coordinates not provided, fetch from customer's default address (with pincode fallback)
      if (!latitude || !longitude) {
        const coords = await getCustomerCoordinates(customerPhoneForByStyle || undefined);
        if (coords) {
          latitude = String(coords.latitude);
          longitude = String(coords.longitude);
          customerApproximateByStyle = !!coords.approximate;
          console.log(`[by-style] Using coordinates from customer address: ${latitude}, ${longitude}, approx=${customerApproximateByStyle}`);
        } else if (customerPhoneForByStyle) {
          console.warn(
            '[by-style] No customer coordinates for distance: query omitted lat/lng and getCustomerCoordinates returned null. ' +
              'Ensure default address has coordinates or a 6-digit pincode (and Geocoding API key on Lambda), or pass latitude/longitude from the app.'
          );
        }
      }

      //get the rules for the discovery
      const rules = await getDiscoveryRules(
        roleId || category || 'all', 'discover', serviceStyle, category || undefined
      );

      //get the max results, default radius, radius, max distance, min rating, sort by from the rules
      const limitFromQueryByStyle = parseInt(String(c.req.query('limit') || ''), 10);
      const maxResults = Math.min(
        DISCOVERY_LIST_DEFAULT_MAX,
        Math.max(
          1,
          Number.isFinite(limitFromQueryByStyle) && limitFromQueryByStyle > 0
            ? limitFromQueryByStyle
            : (rules.discovery_max_results ?? DISCOVERY_LIST_DEFAULT_MAX)
        )
      );
      const radius = discoveryCustomerRadiusKm({
        rules,
        serviceStyleNorm: serviceStyleNormByStyle,
        radiusFromQuery: c.req.query('radius') || undefined,
      });
      const maxDistanceKm = c.req.query('maxDistance') ? parseFloat(c.req.query('maxDistance')!) : null;
      const minRatingVal = c.req.query('minRating') ? parseFloat(c.req.query('minRating')!) : null;
      const sortBy = c.req.query('sortBy') || (rules.discovery_sort_default as string) || 'relevance';

      //get the acceptable styles for the service style
      const acceptableStyles = acceptableStylesForService(serviceStyle);
      //get the customer latitude and longitude
      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;
      if (
        (customerLat == null ||
          customerLng == null ||
          !Number.isFinite(customerLat) ||
          !Number.isFinite(customerLng)) &&
        (latitude || longitude)
      ) {
        console.warn('[by-style] Invalid latitude/longitude query values; distance will be omitted', {
          latitude,
          longitude,
        });
      }
      //check if the service style is at_center
      const isAtCenter = serviceStyle === 'at_center';


      // ────────────────────────────────────────────────────────
      // 2. BUILD CATEGORY KEYS FROM REQUEST (role-agnostic)
      //    Support both text labels and UUIDs in vendor_services.category
      // ────────────────────────────────────────────────────────
      const isUuid = (s?: string) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
      const rawCategoryKeys: string[] = [];
      if (category) rawCategoryKeys.push(String(category));
      if (roleId) rawCategoryKeys.push(String(roleId));
      appendVetDiscoveryCategoryAliasKeys(rawCategoryKeys, category);
      const catTextExact: string[] = rawCategoryKeys.filter(k => !isUuid(k)).map(k => k.toLowerCase());
      const catTextLike: string[] = catTextExact.map(k => `%${k}%`);
      const catUUIDs: string[] = rawCategoryKeys.filter(k => isUuid(k));
      const isVetCategoryDiscoveryByStyle = catTextExact.some((c) =>
        ['vet', 'vet care', 'veterinary', 'veterinarian'].includes(c)
      );

      const boardingDiscoverySearchByStyle =
        catTextExact.some((c) => ['boarding', 'pet_boarding'].includes(c)) ||
        (roleId &&
          ['pet_boarding', 'boarding'].includes(String(roleId).toLowerCase().replace(/-/g, '_')));

      // Declare these here so they are available inside strictCustomDiscoverySql (avoids TDZ errors).
      const trainingDiscoverySearchByStyle = catTextExact.some(
        (c) => c === 'training' || c.includes('training')
      );

      const behaviorHubDiscoverySearchByStyle = catTextRequestsBehaviorHub(catTextExact);

      // Strict catalogue category IDs from the `category` query param only (not roleId) — custom services must match.
      const categoryOnlyKeys: string[] = [];
      if (category) categoryOnlyKeys.push(String(category));
      const strictFromUuid = categoryOnlyKeys.filter((k) => isUuid(k));
      const strictFromText = categoryOnlyKeys
        .filter((k) => !isUuid(k))
        .map((k) => k.toLowerCase().trim())
        .filter(Boolean);
      let strictCategoryIds: string[] = [...strictFromUuid];
      if (strictFromText.length > 0) {
        const slugRes = await services_by_styleRepo.dbServicesByStyle0(strictFromText).catch(() => ({ rows: [] as { id: string }[] }));
        for (const row of slugRes.rows || []) {
          if (row?.id && !strictCategoryIds.includes(row.id)) strictCategoryIds.push(row.id);
        }
      }
      const hasVsCategoryIdCol = await columnExists('vendor_services', 'category_id');
      const strictCustomDiscoverySql =
        strictCategoryIds.length > 0 && hasVsCategoryIdCol
          ? (() => {
              const UUID_RE =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              const clean = strictCategoryIds.filter((id) => UUID_RE.test(String(id).trim()));
              if (clean.length === 0) return '';
              const arr = `ARRAY[${clean.map((id) => `'${String(id).trim()}'::uuid`).join(',')}]::uuid[]`;
              if (boardingDiscoverySearchByStyle) {
                return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND (
        (vs.category_id IS NOT NULL AND vs.category_id = ANY(${arr}))
        OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('boarding', 'pet_boarding', 'pet boarding')
      )
    )
  )`;
              }
              if (trainingDiscoverySearchByStyle) {
                return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND (
        (vs.category_id IS NOT NULL AND vs.category_id = ANY(${arr}))
        OR LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%training%'
        OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('behavioral','behaviour','behavioural','behaviourist','behavior','behavior_modification')
        OR TRIM(COALESCE(vs.category, '')) = ''
        OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})
      )
    )
  )`;
              }
              return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND vs.category_id IS NOT NULL
      AND vs.category_id = ANY(${arr})
    )
  )`;
            })()
          : trainingDiscoverySearchByStyle && hasVsCategoryIdCol
            ? ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND (
        LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%training%'
        OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('behavioral','behaviour','behavioural','behaviourist','behavior','behavior_modification')
        OR TRIM(COALESCE(vs.category, '')) = ''
        OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})
      )
    )
  )`
          : boardingDiscoverySearchByStyle && hasVsCategoryIdCol
            ? ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND LOWER(TRIM(COALESCE(vs.category, ''))) IN ('boarding', 'pet_boarding', 'pet boarding')
    )
  )`
            : '';

      let boardingCustomCategoryIdOrByStyleSql = '';
      if (boardingDiscoverySearchByStyle && hasVsCategoryIdCol) {
        const slugResByStyle = await services_by_styleRepo.dbServicesByStyle1().catch(() => ({ rows: [] as { id: string }[] }));
        const idB = (slugResByStyle.rows || []).map((r: any) => r?.id).filter(Boolean);
        const UUID_RE_BS =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const cleanB = idB.filter((id: string) => UUID_RE_BS.test(String(id).trim()));
        if (cleanB.length > 0) {
          const uuidListBs = cleanB.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
          boardingCustomCategoryIdOrByStyleSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidListBs}]::uuid[])
                )`;
        }
      }

      const nutritionDiscoverySearchByStyle =
        catTextExact.some(
          (c) =>
            ['nutrition', 'nutritionist', 'pet_nutritionist', 'pet nutritionist'].includes(c) ||
            c.includes('nutritionist') ||
            c === 'pet nutrition' ||
            (c.length >= 8 && c.startsWith('nutrition'))
        ) ||
        (roleId &&
          ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
            String(roleId).toLowerCase().replace(/-/g, '_')
          ));

      const boardingRoleUncategorizedOrByStyle =
        boardingDiscoverySearchByStyle
          ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN ('boarding', 'pet_boarding'))`
          : '';

      const nutritionRoleUncategorizedOrByStyle =
        nutritionDiscoverySearchByStyle
          ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN ('pet_nutritionist','nutritionist','nutritionist_center','nutritionist_solo'))`
          : '';

      const trainingRoleUncategorizedOrByStyle =
        trainingDiscoverySearchByStyle
          ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST}))`
          : '';

      // Role-based bypass: show training center vendors for at_center training search
      // even when their services are mis-categorized (e.g. vendor set category='Boarding').
      const trainingRoleCenterBypassOrByStyle =
        trainingDiscoverySearchByStyle && isAtCenter
          ? ` OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})`
          : '';

      const trainingCategoryAliasVendorOrByStyle = trainingDiscoverySearchByStyle
        ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
        : '';

      const behaviorRoleUncategorizedOrByStyle = behaviorHubDiscoverySearchByStyle
        ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST}))`
        : '';
      const behaviorCategoryAliasVendorOrByStyle = behaviorHubDiscoverySearchByStyle
        ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
        : '';
      const behaviorTrainingCategoryVendorOrByStyle = behaviorHubDiscoverySearchByStyle
        ? ` OR (
              LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'
              AND LOWER(TRIM(COALESCE(r.name, ''))) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST})
            )`
        : '';

      const walkerCategoryDiscoveryOrByStyle =
        catTextExact.some((c) => ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c))
          ? ` OR (
              vs.service_style = 'at_home'
              AND (
                LOWER(COALESCE(vs.service_name, '')) LIKE '%dog%walk%'
                OR LOWER(COALESCE(vs.service_name, '')) LIKE '%pet%walk%'
                OR (
                  LOWER(COALESCE(vs.service_name, '')) LIKE '%walk%'
                  AND LOWER(COALESCE(vs.service_name, '')) NOT LIKE '%walk-in%'
                )
              )
              AND (
                TRIM(COALESCE(vs.category, '')) = ''
                OR LOWER(COALESCE(vs.category, '')) = ANY(ARRAY['vet', 'veterinarian', 'veterinary', 'vet care', 'grooming', 'other']::text[])
              )
            )`
          : '';

      const vetCategoryEmptyOrByStyle = isVetCategoryDiscoveryByStyle
        ? ` OR ${sqlVetHubPlaceholderCategoryOr('vs', 'v.role_id')}`
        : '';

      const vetExcludeNonVetSqlByStyle = isVetCategoryDiscoveryByStyle
        ? sqlVetHubExcludeNonVetServices('vs')
        : '';

      // ────────────────────────────────────────────────────────
      // 3. SCOPED HELPERS
      // ────────────────────────────────────────────────────────
      const hasLogoUrl = await columnExists('vendors', 'logo_url');
      const logoCol = hasLogoUrl ? 'v.logo_url' : 'NULL';
      const hasVendorSpecializationsColByStyle = await columnExists('vendors', 'specializations');
      const vendorSpecsJsonbSqlByStyle = hasVendorSpecializationsColByStyle ? 'v.specializations' : 'NULL::jsonb';

      const distResolverByStyle = new DistanceResolver(customerLat, customerLng, customerApproximateByStyle);

      /** Fetch published vendor_services rows matching the requested styles and targeted categories */
      const fetchServices = async (vendorId: string, vendorRoleName?: string | null) => {
        const boardingUncatSqlByStyle =
          boardingDiscoverySearchByStyle &&
          vendorRoleName &&
          ['boarding', 'pet_boarding'].includes(String(vendorRoleName).toLowerCase())
            ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
            : '';
        const nutritionUncatSqlByStyle =
          nutritionDiscoverySearchByStyle &&
          vendorRoleName &&
          ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
            String(vendorRoleName).toLowerCase()
          )
            ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
            : '';
        const trainingUncatSqlByStyle =
          trainingDiscoverySearchByStyle && vendorRoleIsTrainingHub(vendorRoleName)
            ? ` OR TRUE`
            : '';
        const trainingCategoryAliasFetchOrByStyle = trainingDiscoverySearchByStyle
          ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
          : '';
        const behaviorUncatSqlByStyle =
          behaviorHubDiscoverySearchByStyle && vendorRoleIsBehaviorHub(vendorRoleName)
            ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
            : '';
        const behaviorCategoryAliasFetchOrByStyle = behaviorHubDiscoverySearchByStyle
          ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
          : '';
        const behaviorTrainingCategoryFetchOrByStyle =
          behaviorHubDiscoverySearchByStyle && vendorRoleIsBehaviorHub(vendorRoleName)
            ? ` OR LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'`
            : '';
        const vetCategoryEmptyForFetchByStyle = isVetCategoryDiscoveryByStyle
          ? ` OR (
              (
                TRIM(COALESCE(vs.category, '')) = ''
                OR LOWER(TRIM(COALESCE(vs.category, ''))) = 'general'
              )
              AND EXISTS (
                SELECT 1 FROM vendors v2
                JOIN roles r2 ON r2.id = v2.role_id
                WHERE v2.id = $1
                  AND LOWER(TRIM(COALESCE(r2.name, ''))) IN ${VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL}
              )
            )`
          : '';
        const categoryFilterSql = (catTextExact.length + catUUIDs.length > 0) ? `
          AND (
            ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
            ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
            ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
            ${boardingUncatSqlByStyle}
            ${nutritionUncatSqlByStyle}
            ${trainingUncatSqlByStyle}
            ${trainingCategoryAliasFetchOrByStyle}
            ${behaviorUncatSqlByStyle}
            ${behaviorCategoryAliasFetchOrByStyle}
            ${behaviorTrainingCategoryFetchOrByStyle}
            ${walkerCategoryDiscoveryOrByStyle}
            ${vetCategoryEmptyForFetchByStyle}
            ${boardingCustomCategoryIdOrByStyleSql}
          )
        ` : '';
        // strictCustomDiscoverySql references `r.name` (the outer vendor query's role join),
        // which is not available inside fetchServices (no roles JOIN here). For training hub
        // vendors the `trainingUncatSqlByStyle = ' OR TRUE'` already bypasses all category
        // filtering, so we can safely skip the strict filter for those vendors.
        const strictCustomSqlForFetch =
          trainingDiscoverySearchByStyle && vendorRoleIsTrainingHub(vendorRoleName)
            ? ''
            : strictCustomDiscoverySql;

        const vetExcludeForFetchByStyle = isVetCategoryDiscoveryByStyle
          ? sqlVetHubExcludeNonVetServices('vs')
          : '';

        const sql = `
          SELECT vs.id, vs.service_id, vs.service_name, vs.price,
                  vs.custom_price,
                  vs.metadata AS vs_metadata,
                  vs.service_style,
                  vs.publish_status,
                  vs.is_enabled,
                  COALESCE(vs.custom_duration, vs.duration_minutes) AS duration,
                  COALESCE(
                    vs.custom_description,
                    sc.description,
                    (SELECT sc2.description FROM service_catalog sc2
                     WHERE sc2.service_name = vs.service_name
                       AND sc2.service_style = vs.service_style LIMIT 1),
                    s.description
                  ) AS description,
                  COALESCE(sc.category_name, vs.category) AS category_name,
                  sc.category_id AS catalog_category_id,
                  sc.service_id AS catalog_service_id
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           LEFT JOIN service_catalog sc ON vs.service_id = sc.id
           WHERE vs.vendor_id = $1
             AND vs.service_style = ANY($2::text[])
             ${isAtCenter ? "AND vs.service_style != 'at_home'" : ''}
            ${categoryFilterSql}
            ${strictCustomSqlForFetch}
            ${vetExcludeForFetchByStyle}
             AND ${sqlVendorServiceDiscoverable('vs', false)}
          ORDER BY vs.price ASC
        `;
        const params =
          (catTextExact.length + catUUIDs.length > 0)
            ? (catTextExact.length > 0
              ? (catUUIDs.length > 0
                ? [vendorId, acceptableStyles, catTextExact, catTextLike, catUUIDs]
                : [vendorId, acceptableStyles, catTextExact, catTextLike])
              : [vendorId, acceptableStyles, [], [], catUUIDs])
            : [vendorId, acceptableStyles];
        const res = await services_by_styleRepo.dbServicesByStyle2(sql, params).catch(() => ({ rows: [] }));

        return deduplicateServices(res.rows.map((s: any) => mapVendorServiceRowForCustomerDiscoveryList(s)));
      };

      let vendorSpecBundleForByStyle = new Map<string, { raw: string[]; displayLabels: string[] }>();
      let vendorStatsByStyle = new Map<string, { serviceCount: number; priceMin?: number; priceMax?: number }>();

      /** Fast-list enrich (shared with discover-services). Null when zero matching services. */
      const enrichVendor = async (vendor: any) => {
        const stats = vendorStatsByStyle.get(String(vendor.vendor_id));
        const services = fullEnrichByStyle
          ? await fetchServices(vendor.vendor_id, vendor.role_name)
          : [];
        const specBundle = vendorSpecBundleForByStyle.get(vendor.vendor_id);
        return enrichDiscoveryListVendor({
          vendor,
          stats: fullEnrichByStyle ? null : stats || { serviceCount: 0 },
          services,
          acceptableStyles,
          distResolver: distResolverByStyle,
          getNextAvailableSlot,
          defaultAvailabilityDisplay: 'Tap to view availability',
          problemTitle: problemTitle || undefined,
          specializations: specBundle?.displayLabels?.length ? specBundle.displayLabels : [],
          fullServices: fullEnrichByStyle,
          includeAvailability: false,
        });
      };

      // ────────────────────────────────────────────────────────
      // 4. QUERY VENDORS FROM `vendors` TABLE (role-agnostic; eligibility via vendor_services)
      // ────────────────────────────────────────────────────────
      const vendorParamsByStyle: any[] =
        (catTextExact.length + catUUIDs.length > 0)
          ? (catTextExact.length > 0
            ? (catUUIDs.length > 0
              ? [acceptableStyles, catTextExact, catTextLike, catUUIDs]
              : [acceptableStyles, catTextExact, catTextLike])
            : [acceptableStyles, [], [], catUUIDs])
          : [acceptableStyles];

      const specKeysByStyle = await resolveSpecializationDiscoveryKeys(specializationFilterByStyle);
      let specializationByStyleFragment = '';
      if (specKeysByStyle.length > 0) {
        const p0 = vendorParamsByStyle.length + 1;
        specializationByStyleFragment = sqlVendorMatchesDeclaredSpecialization(p0);
        vendorParamsByStyle.push(
          specKeysByStyle.map((k) => k.trim().toLowerCase()),
          specializationDiscoveryIlikePatterns(specKeysByStyle)
        );
      }
      console.log(`[by-style] specialization filter: raw="${specializationFilterByStyle}" keys=${JSON.stringify(specKeysByStyle)} fragmentApplied=${specializationByStyleFragment.length > 0}`);

      const vendorDistanceColsByStyle = await vendorDistanceSelectColumnsSql('v');
      const vendorSql = `
        SELECT DISTINCT ON (v.id)
          v.id AS vendor_id, v.business_name, v.owner_name, v.phone,
          v.address, v.city, v.state, v.latitude, v.longitude, v.pincode, v.metadata,
          ${vendorSpecsJsonbSqlByStyle} AS v_specs_jsonb,
          ${vendorDistanceColsByStyle},
          v.profile_photo_url, ${logoCol} AS logo_url, v.vendor_type,
          v.is_online,
          r.id AS role_id,
          r.name AS role_name, r.display_name AS role_display_name,
          r.config AS role_config,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) AS avg_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) AS review_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND ${sqlVendorDiscoverableStatus('v')}
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          ${specializationByStyleFragment}
          AND EXISTS (
            SELECT 1
            FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND ${sqlVendorServiceDiscoverable('vs', false)}
              AND vs.service_style = ANY($1::text[])
              ${(catTextExact.length + catUUIDs.length > 0) ? `
              AND (
                ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($2::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($3::text[])` : `FALSE`}
                ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
                ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($4::text[])` : ``}
                ${boardingRoleUncategorizedOrByStyle}
                ${nutritionRoleUncategorizedOrByStyle}
                ${trainingRoleUncategorizedOrByStyle}
                ${trainingRoleCenterBypassOrByStyle}
                ${trainingCategoryAliasVendorOrByStyle}
                ${behaviorRoleUncategorizedOrByStyle}
                ${behaviorCategoryAliasVendorOrByStyle}
                ${behaviorTrainingCategoryVendorOrByStyle}
                ${walkerCategoryDiscoveryOrByStyle}
                ${vetCategoryEmptyOrByStyle}
                ${boardingCustomCategoryIdOrByStyleSql}
              )` : ``}
              ${strictCustomDiscoverySql}
              ${vetExcludeNonVetSqlByStyle}
          )
          ${trainingDiscoverySearchByStyle || behaviorHubDiscoverySearchByStyle ? '' : `AND ${sqlVendorAvailabilityOrNotConfigured('v')}`}
        ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT ${maxResults}
      `;

      const vendorRows = await services_by_styleRepo.dbServicesByStyle3(vendorSql, vendorParamsByStyle)
      vendorSpecBundleForByStyle = await batchLoadVendorSpecializationsForDiscovery(
        vendorRows.rows || []
      );
      const vendorRadiusLookupByStyle = new Map<
        string,
        { service_radius?: unknown; service_distance_km?: unknown }
      >();
      for (const row of vendorRows.rows) {
        vendorRadiusLookupByStyle.set(row.vendor_id, {
          service_radius: row.service_radius,
          service_distance_km: row.service_distance_km,
        });
      }
      const byStyleVendorIds = (vendorRows.rows || []).map((r: any) => String(r.vendor_id));
      if (!fullEnrichByStyle && byStyleVendorIds.length > 0) {
        const vetExcludeExtra = isVetCategoryDiscoveryByStyle
          ? sqlVetHubExcludeNonVetServices('vs')
          : undefined;
        vendorStatsByStyle = await services_by_styleRepo.dbFetchDiscoveryListStatsForVendors(
          byStyleVendorIds,
          {
            acceptableStyles,
            isAtCenter,
            catTextExact,
            catTextLike,
            catUUIDs,
            extraAndSql: vetExcludeExtra,
          }
        );
      }
      console.log(
        '[by-style] vendorRows',
        vendorRows.rows?.length,
        acceptableStyles,
        catTextExact,
        catTextLike,
        catUUIDs
      );

      // 6. ENRICH ALL VENDORS (bounded concurrency)
      const providers = await enrichDiscoveryListVendorsConcurrent(
        vendorRows.rows || [],
        enrichVendor
      );

      // #region agent log
      fetch('http://127.0.0.1:7284/ingest/8a051ee5-5764-433a-b7be-541c81de6d03',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2643f5'},body:JSON.stringify({sessionId:'2643f5',runId:'parity-port',hypothesisId:'E',location:'services-by-style.service.ts:enrich',message:'by-style develop enrich parity',data:{fullEnrichByStyle,slimByStyle,maxResults,vendorRowCount:(vendorRows.rows||[]).length,providerCount:providers.length,firstServicesLen:Array.isArray((providers[0] as any)?.services)?((providers[0] as any).services as any[]).length:-1},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // 7. FILTER
      let results = providers as any[];

      if (minRatingVal != null && minRatingVal > 0) {
        results = results.filter((p) => p.rating >= minRatingVal);
      }

      const platformHomeByStyle = rules.discovery_radius_km_home ?? 10;
      if (customerLat && customerLng) {
        if (serviceStyleNormByStyle === 'at_home') {
          const sittingRelaxedByStyle = Boolean(
            catTextExact.some((c) =>
              ['sitting', 'pet_sitter', 'sitter', 'sitter_solo'].includes(c)
            ) ||
              (Boolean(roleId) &&
                ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'].includes(
                  String(roleId).toLowerCase().replace(/-/g, '_')
                ))
          );
          const withinRadius = results.filter((p) => {
            const row = vendorRadiusLookupByStyle.get(p.vendorId);
            const vendorCap = vendorHomeServiceRadiusKm(row || {}) ?? platformHomeByStyle;
            const cap =
              maxDistanceKm != null && Number.isFinite(maxDistanceKm)
                ? Math.min(maxDistanceKm, vendorCap)
                : radius != null && radius > 0
                  ? Math.min(radius, vendorCap)
                  : vendorCap;
            return providerWithinRadiusKm(p.distance, cap, true);
          });
          if (withinRadius.length > 0) {
            results = withinRadius;
          } else if (!sittingRelaxedByStyle) {
            results = withinRadius;
          }
        } else {
          const effectiveMaxKm =
            maxDistanceKm ?? (radius != null && radius > 0 ? radius : null);
          if (effectiveMaxKm != null) {
            results = results.filter((p) =>
              providerWithinRadiusKm(p.distance, effectiveMaxKm, false)
            );
          }
        }
      }

      // ────────────────────────────────────────────────────────
      // 8. SORT
      // ────────────────────────────────────────────────────────
      results.sort((a, b) => {
        switch (sortBy) {
          case 'distance':
            if (a.distance == null && b.distance == null) return 0;
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance - b.distance;

          case 'rating':
            return b.rating - a.rating;

          case 'price':
            return (a.services[0]?.price || 0) - (b.services[0]?.price || 0);

          case 'relevance':
          default: {
            const score = (p: any) =>
              p.rating * 10 +
              p.reviewCount * 0.5 +
              (p.distance != null ? Math.max(0, 50 - p.distance) : 0);
            return score(b) - score(a);
          }
        }
      });

      // ────────────────────────────────────────────────────────
      // 9. RESPOND
      // ────────────────────────────────────────────────────────
      return c.json({
        success: true,
        style: serviceStyle,
        providers: results,
        vendors: results, // backward compatibility
        total: results.length,
        specializationApplied: specializationByStyleFragment.length > 0 ? specializationFilterByStyle : null,
        appliedFilters: {
          minRating: minRatingVal,
          maxDistance:
            maxDistanceKm ??
            (customerLat != null &&
            customerLng != null &&
            radius != null &&
            radius > 0
              ? radius
              : undefined),
          homeDiscoveryFallbackKm:
            serviceStyleNormByStyle === 'at_home' ? platformHomeByStyle : undefined,
          sortBy,
        },
      });
    } catch (error: any) {
      console.error('[by-style] Error:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
}
