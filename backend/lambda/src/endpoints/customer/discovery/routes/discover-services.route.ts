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
} from '../shared/legacy-helpers';

export function registerDiscoverServicesRoute(app: Hono) {
  app.get("/customer/discover-services", async (c) => {
    try {
      // 1) Parse + validate
      const serviceStyle = c.req.query('serviceStyle') || c.req.query('style');
      if (!serviceStyle) {
        return c.json({
          error: 'Service style is required (tele, at_home, at_center)',
          success: false,
        }, 400);
      }

      const serviceStyleNormDiscover = normalizeServiceStyle(serviceStyle) || serviceStyle;

      const category = c.req.query('category');
      const roleId = c.req.query('roleId');
      const problemTitle = c.req.query('problemTitle');
      const specializationFilterDiscover = (
        c.req.query('specialization') ||
        c.req.query('specializationId') ||
        ''
      ).trim();
      // Accept lat/lon and latitude/longitude aliases (different parts of the
      // app use different spellings — keep them all working).
      let latitude = c.req.query('latitude') || c.req.query('lat');
      let longitude =
        c.req.query('longitude') || c.req.query('lng') || c.req.query('lon');

      // If coordinates not provided, fetch from customer address (with pincode fallback)
      let customerApproximateDiscover = false;
      if (!latitude || !longitude) {
        const customerPhone = c.req.query('customerPhone') || c.req.query('phone') || null;
        const coords = await getCustomerCoordinates(customerPhone || undefined);
        if (coords) {
          latitude = String(coords.latitude);
          longitude = String(coords.longitude);
          customerApproximateDiscover = !!coords.approximate;
          console.log(`[discover-services] Using coordinates from customer address: ${latitude}, ${longitude}, approx=${customerApproximateDiscover}`);
        }
      }

      // Rules and sorting defaults
      const rules = await getDiscoveryRules(
        roleId || category || 'all', 'discover', serviceStyle as string, category || undefined
      );
      const maxResults = Math.min(100, Math.max(1, rules.discovery_max_results ?? 50));
      const radius = discoveryCustomerRadiusKm({
        rules,
        serviceStyleNorm: serviceStyleNormDiscover,
        radiusFromQuery: c.req.query('radius') || undefined,
      });
      const maxDistanceKm = c.req.query('maxDistance') ? parseFloat(c.req.query('maxDistance')!) : null;
      const minRatingVal = c.req.query('minRating') ? parseFloat(c.req.query('minRating')!) : null;
      const sortBy = c.req.query('sortBy') || (rules.discovery_sort_default as string) || 'relevance';

      const acceptableStyles = acceptableStylesForService(serviceStyle);
      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;
      const isAtCenter = serviceStyle === 'at_center';

      // 2) Category keys (text exact/LIKE + UUID)
      const isUuid = (s?: string) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
      const rawCategoryKeys: string[] = [];
      if (category) rawCategoryKeys.push(String(category));
      if (roleId) rawCategoryKeys.push(String(roleId));
      appendVetDiscoveryCategoryAliasKeys(rawCategoryKeys, category);
      const catTextExact: string[] = rawCategoryKeys.filter(k => !isUuid(k)).map(k => k.toLowerCase());
      const catTextLike: string[] = catTextExact.map(k => `%${k}%`);
      const catUUIDs: string[] = rawCategoryKeys.filter(k => isUuid(k));
      const isVetCategoryDiscovery = catTextExact.some((c) =>
        ['vet', 'vet care', 'veterinary', 'veterinarian'].includes(c)
      );

      /** Solo sitters often lack vendor_availability_v2 rows; still show them if they have published at_home services. */
      const sittingDiscoveryRelaxed = Boolean(
        catTextExact.some((c) =>
          ['sitting', 'pet_sitter', 'sitter', 'sitter_solo'].includes(c)
        ) ||
          (Boolean(roleId) &&
            ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'].includes(
              String(roleId).toLowerCase().replace(/-/g, '_')
            ))
      );

      /** Pet boarding list uses category=boarding / roleId=pet_boarding; some centers have at_center rows with empty vs.category */
      const boardingDiscoverySearch =
        catTextExact.some((c) => ['boarding', 'pet_boarding'].includes(c)) ||
        (roleId &&
          ['pet_boarding', 'boarding'].includes(String(roleId).toLowerCase().replace(/-/g, '_')));

      /**
       * Nutrition: catalog/custom rows may leave vs.category empty while vendors.role is pet_nutritionist / nutritionist
       * (mirrors boardingRoleUncategorizedOr so experts still appear in discovery).
       */
      const nutritionDiscoverySearch =
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

      /**
       * Training hub (?category=training): vendor_services often use "Behavioral" while discovery filters on "training".
       * Mirror nutrition/boarding: alias category text + allow empty category for trainer/behaviorist roles.
       */
      const trainingDiscoverySearch =
        !sittingDiscoveryRelaxed &&
        catTextExact.some((c) => c === 'training' || c.includes('training'));

      /**
       * Behavioral hub (`?category=behaviourist`): services are usually tagged `training` / `behavioral` / blank
       * (same as the training hub). The literal `behaviourist` category on `vendor_services` is rare, so without
       * these OR branches behaviorists disappear from UniversalServicesByStyle / home flow.
       */
      const behaviorHubDiscoverySearch =
        !sittingDiscoveryRelaxed && catTextRequestsBehaviorHub(catTextExact);

      /** Dog walk add-on for non-walker accounts: category may be blank or still "vet" / "grooming". */
      const walkerCategoryDiscoveryOr =
        !sittingDiscoveryRelaxed &&
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

      /**
       * Boarding discovery: custom rows may store the hub only in `vendor_services.category_id` (text `vs.category` empty).
       * Text filters alone miss those rows — especially for pet_sitter / multi-role vendors offering at_center boarding.
       */
      const hasVsCategoryIdDiscover = await columnExists('vendor_services', 'category_id');
      let boardingCustomCategoryIdOrSql = '';
      if (boardingDiscoverySearch && hasVsCategoryIdDiscover) {
        const slugRes = await query(
          `SELECT id::text FROM service_categories
           WHERE COALESCE(is_active, true) = true
             AND (
               LOWER(TRIM(category_id)) = ANY($1::text[])
               OR LOWER(TRIM(name)) = ANY($1::text[])
             )`,
          [['boarding', 'pet_boarding', 'pet boarding']]
        ).catch(() => ({ rows: [] as { id: string }[] }));
        const ids = (slugRes.rows || []).map((r: any) => r?.id).filter(Boolean);
        const UUID_RE =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const clean = ids.filter((id: string) => UUID_RE.test(String(id).trim()));
        if (clean.length > 0) {
          const uuidList = clean.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
          boardingCustomCategoryIdOrSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidList}]::uuid[])
                )`;
        }
      }

      let trainingCustomCategoryIdOrSql = '';
      if (trainingDiscoverySearch && hasVsCategoryIdDiscover) {
        const slugResTraining = await query(
          `SELECT id::text FROM service_categories
           WHERE COALESCE(is_active, true) = true
             AND (
               LOWER(TRIM(category_id)) = ANY($1::text[])
               OR LOWER(TRIM(name)) = ANY($1::text[])
             )`,
          [['training', 'pet training', 'dog training']]
        ).catch(() => ({ rows: [] as { id: string }[] }));
        const idsT = (slugResTraining.rows || []).map((r: any) => r?.id).filter(Boolean);
        const UUID_RE_T =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const cleanT = idsT.filter((id: string) => UUID_RE_T.test(String(id).trim()));
        if (cleanT.length > 0) {
          const uuidListT = cleanT.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
          trainingCustomCategoryIdOrSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidListT}]::uuid[])
                )`;
        }
      }

      // 3) Helpers
      const hasLogoUrl = await columnExists('vendors', 'logo_url');
      const logoCol = hasLogoUrl ? 'v.logo_url' : 'NULL';
      const hasVendorSpecializationsCol = await columnExists('vendors', 'specializations');
      const vendorSpecsJsonbSql = hasVendorSpecializationsCol ? 'v.specializations' : 'NULL::jsonb';

      const distResolverDiscover = new DistanceResolver(customerLat, customerLng, customerApproximateDiscover);

      const SITTER_ROLE_NAMES_LOWER = ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'];

      // Fetch only matching services (style + category; published/auto_published)
      const fetchServices = async (vendorId: string, _vendorRoleName?: string | null) => {
        /**
         * Pet Sitting uses relaxed calendar rules but must still filter **services** by sitting-relevant
         * categories (same as vendor EXISTS). Previously `sitterRoleBypass` skipped all category SQL and
         * returned every at_home row for sitters (dog walk / vet / custom boarding leaked into the hub).
         */
        const sitterRoleBypass = sittingDiscoveryRelaxed;

        const boardingUncatSql =
          !sitterRoleBypass &&
          boardingDiscoverySearch &&
          _vendorRoleName &&
          ['boarding', 'pet_boarding'].includes(String(_vendorRoleName).toLowerCase())
            ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
            : '';
        const nutritionUncatSql =
          !sitterRoleBypass &&
          nutritionDiscoverySearch &&
          _vendorRoleName &&
          ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
            String(_vendorRoleName).toLowerCase()
          )
            ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
            : '';
        const trainingUncatSql =
          !sitterRoleBypass &&
          trainingDiscoverySearch &&
          vendorRoleIsTrainingHub(_vendorRoleName)
            ? ` OR TRUE`
            : '';
        const vetCategoryEmptyForFetch =
          !sitterRoleBypass && isVetCategoryDiscovery
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
        const trainingCategoryAliasFetchOr =
          !sitterRoleBypass && trainingDiscoverySearch ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}` : '';
        const behaviorUncatSql =
          !sitterRoleBypass &&
          behaviorHubDiscoverySearch &&
          vendorRoleIsBehaviorHub(_vendorRoleName)
            ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
            : '';
        const behaviorCategoryAliasFetchOr =
          !sitterRoleBypass && behaviorHubDiscoverySearch ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}` : '';
        const behaviorTrainingCategoryFetchOr =
          !sitterRoleBypass &&
          behaviorHubDiscoverySearch &&
          vendorRoleIsBehaviorHub(_vendorRoleName)
            ? ` OR LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'`
            : '';
        const categoryFilterSql =
          !sitterRoleBypass && (catTextExact.length + catUUIDs.length > 0)
            ? `
          AND (
            ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
            ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
            ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
            ${boardingUncatSql}
            ${nutritionUncatSql}
            ${trainingUncatSql}
            ${trainingCategoryAliasFetchOr}
            ${behaviorUncatSql}
            ${behaviorCategoryAliasFetchOr}
            ${behaviorTrainingCategoryFetchOr}
            ${walkerCategoryDiscoveryOr}
            ${vetCategoryEmptyForFetch}
            ${boardingCustomCategoryIdOrSql}
            ${trainingCustomCategoryIdOrSql}
          )
        `
            : '';
        const sittingRoleUncategorizedForFetch =
          sitterRoleBypass &&
          sittingDiscoveryRelaxed &&
          _vendorRoleName &&
          SITTER_ROLE_NAMES_LOWER.includes(String(_vendorRoleName).toLowerCase())
            ? ` OR (
                TRIM(COALESCE(vs.category, '')) = ''
                AND COALESCE(vs.is_custom_service, false) = false
              )`
            : '';
        // Mirror buildDiscoveryVendorExistsSql.sittingExcludeNonSittingSql so the sitter
        // service fetch never returns walking / vet / grooming / training etc. services that
        // the relaxed sitting bypass would otherwise allow through. Previously this constant
        // was referenced below without being defined → ReferenceError → 500 on /discover-services
        // for the sitting hub.
        const sittingExcludeNonSittingSql = sittingDiscoveryRelaxed
          ? `
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
              )`
          : '';
        const sittingRelaxedFetchCategorySql =
          sitterRoleBypass && sittingDiscoveryRelaxed && (catTextExact.length + catUUIDs.length > 0)
            ? `
            AND (
              ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
              ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
              ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
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
              ${sittingRoleUncategorizedForFetch}
            )
            ${sittingExcludeNonSittingSql}`
            : '';
        const styleMatchSql =
          sitterRoleBypass && !isAtCenter
            ? `(vs.service_style = ANY($2::text[]) OR vs.service_style IS NULL OR TRIM(COALESCE(vs.service_style, '')) = '')`
            : `vs.service_style = ANY($2::text[])`;
        const vsDiscoverSql = sqlVendorServiceDiscoverable('vs', sitterRoleBypass);
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
                   (SELECT sc.description FROM service_catalog sc
                    WHERE sc.service_name = vs.service_name
                      AND sc.service_style = vs.service_style LIMIT 1),
                   s.description
                 ) AS description,
                 vs.category AS category_name
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
             AND ${styleMatchSql}
             ${isAtCenter ? "AND vs.service_style != 'at_home'" : ''}
            ${categoryFilterSql}${sittingRelaxedFetchCategorySql}
             AND ${vsDiscoverSql}
          ORDER BY vs.price ASC
        `;
        const params =
          sitterRoleBypass
            ? sittingRelaxedFetchCategorySql
              ? catTextExact.length > 0
                ? catUUIDs.length > 0
                  ? [vendorId, acceptableStyles, catTextExact, catTextLike, catUUIDs]
                  : [vendorId, acceptableStyles, catTextExact, catTextLike]
                : [vendorId, acceptableStyles, [], [], catUUIDs]
              : [vendorId, acceptableStyles]
            : (catTextExact.length + catUUIDs.length > 0)
              ? (catTextExact.length > 0
                ? (catUUIDs.length > 0
                  ? [vendorId, acceptableStyles, catTextExact, catTextLike, catUUIDs]
                  : [vendorId, acceptableStyles, catTextExact, catTextLike])
                : [vendorId, acceptableStyles, [], [], catUUIDs])
              : [vendorId, acceptableStyles];
        const res = await query(sql, params).catch(() => ({ rows: [] }));

        return deduplicateServices(res.rows.map((s: any) => mapVendorServiceRowForCustomerDiscoveryList(s)));
      };

      /** Filled after vendor SQL runs; enrichVendor reads resolved specialization labels. */
      let vendorSpecBundleForDiscover = new Map<string, { raw: string[]; displayLabels: string[] }>();

      // Enrichment
      const enrichVendor = async (vendor: any) => {
        // Load matching published services first. Do NOT drop by role_config here: primary
        // role (e.g. veterinarian) often omits at_home in serviceStyles even when the same
        // account publishes a custom dog-walk (at_home). vendor_services is source of truth.
        const services = await fetchServices(vendor.vendor_id, vendor.role_name);
        if (services.length === 0) return null;

        // Role UI fields
        let roleCfg: any = {};
        try {
          roleCfg = typeof vendor.role_config === 'string'
            ? (vendor.role_config ? JSON.parse(vendor.role_config) : {})
            : (vendor.role_config || {});
        } catch { roleCfg = {}; }
        const roleIcon = roleCfg?.icon || null;
        const roleImage = roleCfg?.iconUrl || roleCfg?.image || null;
        const roleCategory = roleCfg?.category || roleCfg?.customer_service || null;
        const customerService = roleCfg?.customer_service || null;

        const distResult = await distResolverDiscover.resolve({
          id: vendor.vendor_id,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          pincode: vendor.pincode,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
        });

        let nextAvailable: any = null;
        try {
          nextAvailable = await getNextAvailableSlot(
            vendor.vendor_id, vendor.phone || '', acceptableStyles
          );
        } catch { /* non-fatal */ }

        // No computed slot (no vendor_availability_v2 or fully booked): still list provider — booking flow uses slots API.
        if (!nextAvailable) {
          nextAvailable = {
            date: '',
            time: '',
            display: sittingDiscoveryRelaxed ? 'Contact for availability' : 'Tap to view availability',
          };
        }

        // Photos + rating + price
        let photos: string[] = [];
        try {
          const meta = typeof vendor.metadata === 'string'
            ? JSON.parse(vendor.metadata || '{}')
            : vendor.metadata;
          const raw = meta?.facility_photos || meta?.photos || [];
          const rawPhotos = Array.isArray(raw) ? raw.slice(0, 5).filter(Boolean) : [];
          const regeneratedPhotos = await Promise.all(
            rawPhotos.map(async (photoUrl: string) => {
              const regenerated = await regeneratePresignedUrl(photoUrl);
              return regenerated;
            })
          );
          photos = regeneratedPhotos.filter((url): url is string => url !== null && url !== undefined);
        } catch { }

        const photoUrl = await getVendorListingPhotoUrl(vendor);
        const prices = services.map((s: any) => s.price).filter((p: number) => p > 0);
        const priceMin = prices.length > 0 ? Math.min(...prices) : undefined;
        const priceMax = prices.length > 0 ? Math.max(...prices) : undefined;

        const specBundle = vendorSpecBundleForDiscover.get(vendor.vendor_id);
        const specializations = specBundle?.displayLabels?.length ? specBundle.displayLabels : [];
        const specialization =
          specializations.length > 0 ? specializations.join(' · ') : null;

        return {
          id: vendor.vendor_id,
          vendorId: vendor.vendor_id,
          providerId: vendor.vendor_id,
          providerType: 'vendor' as const,
          name: vendor.business_name || vendor.owner_name,
          phone: vendor.phone,
          address: vendor.address,
          city: vendor.city,
          roleId: vendor.role_id || null,
          role: vendor.role_display_name || vendor.role_name,
          roleName: vendor.role_name || vendor.role_display_name || '',
          roleDisplayName: vendor.role_display_name || '',
          roleIcon,
          roleImage,
          roleCategory,
          customerService,
          vendorType: vendor.vendor_type === 'solo' ? 'solo' : 'business',
          photo: photoUrl,
          photoUrl: photoUrl,
          rating: parseFloat(vendor.avg_rating || '0'),
          reviewCount: parseInt(vendor.review_count || '0', 10),
          distance: distResult?.km ?? null,
          distanceKm: distResult?.km ?? null,
          distanceText: distResult?.distanceText ?? null,
          nextAvailable,
          serviceStyles: acceptableStyles,
          isVerified: true,
          isOnline: vendorRowIsOnline(vendor.is_online),
          is_online: vendor.is_online,
          photos: photos.length > 0 ? photos : undefined,
          priceMin: priceMin && priceMin > 0 ? priceMin : undefined,
          priceMax: priceMax && priceMax > 0 && priceMax !== priceMin ? priceMax : undefined,
          bestForProblem: problemTitle || undefined,
          specializations,
          specialization,
          services,
        };
      };

      const vendorExistsDiscover = await buildDiscoveryVendorExistsSql({
        category,
        roleId,
        serviceStyle: serviceStyleNormDiscover,
        sittingRelaxed: sittingDiscoveryRelaxed,
        paramOffset: 1,
        isAtCenter,
        forVendorCount: false,
      });
      const vendorParamsDiscover: any[] = [...vendorExistsDiscover.params];

      const specKeysDiscover = await resolveSpecializationDiscoveryKeys(specializationFilterDiscover);
      let specializationDiscoverFragment = '';
      if (specKeysDiscover.length > 0) {
        const p0 = vendorParamsDiscover.length + 1;
        specializationDiscoverFragment = sqlVendorMatchesDeclaredSpecialization(p0);
        vendorParamsDiscover.push(
          specKeysDiscover.map((k) => k.trim().toLowerCase()),
          specializationDiscoveryIlikePatterns(specKeysDiscover)
        );
      }

      const vendorDistanceColsDiscover = await vendorDistanceSelectColumnsSql('v');
      const vendorSql = `
        SELECT DISTINCT ON (v.id)
          v.id AS vendor_id, v.business_name, v.owner_name, v.phone,
          v.address, v.city, v.state, v.latitude, v.longitude, v.pincode, v.metadata,
          ${vendorSpecsJsonbSql} AS v_specs_jsonb,
          ${vendorDistanceColsDiscover},
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
          ${specializationDiscoverFragment}
          AND ${vendorExistsDiscover.sql}
          ${vendorExistsDiscover.availabilitySql}
        ORDER BY v.id, avg_rating DESC NULLS LAST
        LIMIT ${maxResults}
      `;

      const vendorRows = await query(vendorSql, vendorParamsDiscover);
      vendorSpecBundleForDiscover = await batchLoadVendorSpecializationsForDiscovery(
        vendorRows.rows || []
      );
      const vendorRadiusLookupDiscover = new Map<
        string,
        { service_radius?: unknown; service_distance_km?: unknown }
      >();
      for (const row of vendorRows.rows) {
        vendorRadiusLookupDiscover.set(row.vendor_id, {
          service_radius: row.service_radius,
          service_distance_km: row.service_distance_km,
        });
      }
      console.log('vendorRows', vendorRows.rows, acceptableStyles, catTextExact, catTextLike, catUUIDs);
      // 6) Enrich and filter
      const seen = new Set<string>();
      const providers: any[] = [];

      for (const row of vendorRows.rows) {
        if (seen.has(row.vendor_id)) continue;
        const provider = await enrichVendor(row);
        if (provider) {
          seen.add(row.vendor_id);
          providers.push(provider);
        }
      }

      // 7) Post-filters
      let results = providers;
      if (minRatingVal != null && minRatingVal > 0) {
        results = results.filter((p) => p.rating >= minRatingVal);
      }

      const platformHomeDiscover = rules.discovery_radius_km_home ?? 10;
      if (customerLat && customerLng) {
        if (serviceStyleNormDiscover === 'at_home') {
          const withinRadius = results.filter((p) => {
            const row = vendorRadiusLookupDiscover.get(p.vendorId);
            const vendorCap = vendorHomeServiceRadiusKm(row || {}) ?? platformHomeDiscover;
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
          } else if (!sittingDiscoveryRelaxed) {
            results = withinRadius;
          }
        } else {
          const effectiveMaxKm =
            maxDistanceKm ?? (radius != null && radius > 0 ? radius : null);
          if (effectiveMaxKm != null) {
            const withinRadius = results.filter((p) =>
              providerWithinRadiusKm(p.distance, effectiveMaxKm, sittingDiscoveryRelaxed)
            );
            if (withinRadius.length > 0) {
              results = withinRadius;
            } else if (!sittingDiscoveryRelaxed) {
              results = withinRadius;
            }
          }
        }
        /* Pet sitting: keep full list when radius would hide every sitter (far away or missing vendor geocode). */
      }

      // 8) Sort
      results.sort((a, b) => {
        switch (String(sortBy)) {
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

      // 9) Respond
      return c.json({
        success: true,
        style: serviceStyle,
        providers: results,
        vendors: results,
        total: results.length,
        appliedFilters: {
          minRating: minRatingVal,
          /** For at_home, distance uses each vendor's service_radius / service_distance_km with fallback homeDiscoveryFallbackKm. */
          maxDistance:
            maxDistanceKm ??
            (customerLat != null &&
            customerLng != null &&
            radius != null &&
            radius > 0
              ? radius
              : undefined),
          homeDiscoveryFallbackKm:
            serviceStyleNormDiscover === 'at_home' ? platformHomeDiscover : undefined,
          sortBy,
        },
      });
    } catch (error: any) {
      console.error('[discover-services] Error:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/available-slots
   * Standard availability API for all service types (vet, grooming, training, walker, etc.).
   * Query: date (required), serviceStyle (at_center | at_home | tele), totalDuration?, staffId?, serviceIds?.
   * Response: { success, slots: [{ time, available, booked?, slotDuration?, bufferMinutes?, serviceStyles? }], date, vendorId, serviceStyle, staffBased?, message? }.
   * Uses vendor_availability_v2 only; supports 006 (time_window_*, service_style, is_enabled) and 057+ (start_time/end_time, service_styles, is_available) schemas.
   * Enforces: (1) past booking window + admin buffer, (2) holidays & breaks, (3) service style per slot, (4) buffer between bookings, (5) max capacity when defined.
   */
}
