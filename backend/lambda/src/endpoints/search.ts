/**
 * ============================================================================
 * SEARCH ENDPOINTS - PostgreSQL-backed universal search
 * ============================================================================
 *
 * - Universal service discovery (GET /search)
 * - Vendor and service keyword search via PostgreSQL
 * - Hub browse, taxonomy resolution, discovery parity with discover-services
 *
 * Service result ids use vendor_services.id so customer /booking/:id and GET /services/:id resolve.
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import {
  expandSearchCategoryForSql,
  getSearchCategoryIlikePatterns,
  isHubBrowseCategoryOnly,
} from '../utils/search-category-aliases';
import { getVendorListingPhotoUrl } from '../utils/vendor-listing-photo';
import { haversineKm } from '../lib/utils/vendor-customer-distance';
import {
  acceptableStylesForService,
  applySearchDiscoveryParity,
  hubSlugToDiscoveryContext,
  resolveEffectiveSearchCategory,
  resolveSearchUserCoords,
} from '../lib/search-discovery-parity';
import {
  buildDiscoveryVendorExistsSql,
  sqlVendorAvailabilityOrNotConfigured,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
  sqlVendorServiceDiscoverable,
} from '../lib/discovery-vendor-query';
import {
  resolveSearchTaxonomy,
  logSearchTaxonomyDebug,
  buildResidualSearchText,
  type CategorySource,
  type SearchCategoryMatch,
} from '../lib/search-taxonomy';
import { hasFtsEntityIds, resolveSearchEntityIds, type SearchEntityIds } from '../lib/sql-search-fts';

/** Whitespace-separated query → tokens (cap avoids huge SQL from pasted text). */
function searchTokens(searchQuery: string, maxTokens = 6): string[] {
  const raw = String(searchQuery || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return raw.slice(0, maxTokens);
}

/** Fill missing listing photos from RDS when search results only have profile_image. */
async function enrichSearchResultPhotos(
  vendors: Array<{ id: string; profileImage?: string | null; vendorId?: string }>,
  services: Array<{ vendorId?: string; vendorProfileImage?: string | null }>
): Promise<void> {
  const needsVendorIds = new Set<string>();
  for (const v of vendors) {
    if (v.id && !v.profileImage) needsVendorIds.add(v.id);
  }
  for (const s of services) {
    if (s.vendorId && !s.vendorProfileImage) needsVendorIds.add(s.vendorId);
  }
  if (needsVendorIds.size === 0) return;

  const { rows } = await query(`SELECT * FROM vendors WHERE id = ANY($1::uuid[])`, [[...needsVendorIds]]);
  const photoById = new Map<string, string | null>();
  await Promise.all(
    rows.map(async (row: Record<string, unknown>) => {
      const id = String(row.id);
      photoById.set(id, await getVendorListingPhotoUrl(row));
    })
  );

  for (const v of vendors) {
    if (!v.profileImage && v.id) {
      const url = photoById.get(v.id);
      if (url) v.profileImage = url;
    }
  }
  for (const s of services) {
    if (!s.vendorProfileImage && s.vendorId) {
      const url = photoById.get(s.vendorId);
      if (url) s.vendorProfileImage = url;
    }
  }
}

/**
 * Post-parity gate: mirrors discover-services fetchServices + "if (services.length === 0) return null".
 * Drops any vendor that has zero customer-listable services of the expected style for the active hub.
 * Runs a single batched query rather than N per-vendor round-trips.
 *
 * sittingRelaxed mirrors discover-services for Pet Sitting: allows NULL is_enabled and NULL/empty
 * service_style so solo sitters who haven't fully configured their catalog still appear.
 */
async function gateVendorsByListableService<T extends { id: string }>(
  vendors: T[],
  acceptableStyles: string[],
  options?: { sittingRelaxed?: boolean }
): Promise<T[]> {
  if (vendors.length === 0 || acceptableStyles.length === 0) return vendors;
  const sittingRelaxed = !!options?.sittingRelaxed;
  const enabledPredicate = sittingRelaxed
    ? '(vs.is_enabled = true OR vs.is_enabled IS NULL)'
    : 'vs.is_enabled = true';
  const stylePredicate = sittingRelaxed
    ? `(vs.service_style = ANY($2::text[]) OR vs.service_style IS NULL OR TRIM(COALESCE(vs.service_style, '')) = '')`
    : 'vs.service_style = ANY($2::text[])';
  try {
    const { rows } = await query(
      `SELECT DISTINCT vs.vendor_id::text AS vendor_id
       FROM vendor_services vs
       WHERE vs.vendor_id = ANY($1::uuid[])
         AND ${enabledPredicate}
         AND (
           vs.publish_status IS NULL
           OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
         )
         AND ${stylePredicate}`,
      [vendors.map((v) => v.id), acceptableStyles]
    );
    const qualifiedIds = new Set(rows.map((r: { vendor_id: string }) => r.vendor_id));
    return vendors.filter((v) => qualifiedIds.has(v.id));
  } catch (err) {
    console.warn('gateVendorsByListableService query failed, skipping gate:', err);
    return vendors;
  }
}

/**
 * After the vendor-listable-service gate drops a vendor, drop their orphan service rows too.
 * Without this, services from gated-out vendors leak through as separate cards in /search
 * (the customer-web dedupe only removes service rows whose vendor row is still present).
 */
function filterServicesToKeptVendors<S extends { vendorId?: string | null }>(
  services: S[],
  keptVendorIds: Set<string>
): S[] {
  return services.filter((s) => {
    const vid = String(s.vendorId ?? '').trim();
    if (!vid) return true;
    return keptVendorIds.has(vid);
  });
}

// ============================================================================
// PRODUCT SEARCH HELPERS
// ============================================================================

/** Hubs that should include ecommerce product results alongside vendor/service results. */
const PRODUCT_SEARCH_HUBS = new Set(['shop', 'pet_shop', 'marketplace', 'pharmacy', 'pet_pharmacy']);

function isProductSearchHub(category: string | undefined): boolean {
  if (!category) return false;
  return PRODUCT_SEARCH_HUBS.has(String(category).toLowerCase().replace(/-/g, '_'));
}

/**
 * Query the products table for a given set of search tokens.
 * Returns empty array if tokens are empty or if the products table does not exist.
 */
async function queryProductsForSearch(
  tokens: string[],
  productLimit: number,
  ftsProductIds?: string[]
): Promise<any[]> {
  if (tokens.length === 0 && !(ftsProductIds && ftsProductIds.length > 0)) return [];
  let productQuery = `
    SELECT p.id, p.name, p.description, p.price, p.image_url, p.thumbnail_url,
           p.category, p.vendor_id, v.business_name AS vendor_name
    FROM products p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.is_active = true
  `;
  const productParams: any[] = [];
  let productParamIndex = 1;

  if (ftsProductIds && ftsProductIds.length > 0) {
    productQuery += ` AND p.id = ANY($${productParamIndex}::uuid[])`;
    productParams.push(ftsProductIds);
    productParamIndex++;
  } else {
    for (const token of tokens) {
      productQuery += ` AND (p.name ILIKE $${productParamIndex} OR COALESCE(p.description, '') ILIKE $${productParamIndex})`;
      productParams.push(`%${token}%`);
      productParamIndex++;
    }
  }

  productQuery += ` ORDER BY p.created_at DESC LIMIT $${productParamIndex}`;
  productParams.push(productLimit);
  try {
    const { rows } = await query(productQuery, productParams);
    return (rows as Record<string, unknown>[]).map((p) => ({
      id: p.id,
      productName: p.name,
      description: p.description ?? null,
      price: p.price ?? null,
      imageUrl: (p.image_url ?? p.thumbnail_url) ?? null,
      category: p.category ?? null,
      vendorId: p.vendor_id ?? null,
      vendorName: p.vendor_name ?? null,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// SEARCH HANDLERS
// ============================================================================

class UniversalSearchHandler extends BaseHandler {
  /** Phase 2: taxonomy metadata returned on every /search response. */
  private taxonomyResponseFields(opts: {
    categories: SearchCategoryMatch[];
    taxonomyResolvedHub: string | null;
    taxonomySource: string;
    effectiveCategory?: string;
    categorySource: CategorySource;
    hubDrivenRetrieval: boolean;
    searchText: string;
  }) {
    return {
      categories: opts.categories,
      taxonomyResolvedHub: opts.taxonomyResolvedHub,
      taxonomySource: opts.taxonomySource,
      effectiveCategory: opts.effectiveCategory ?? null,
      categorySource: opts.categorySource,
      hubDrivenRetrieval: opts.hubDrivenRetrieval,
      searchText: opts.searchText,
    };
  }

  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const qs = context.event.queryStringParameters as Record<string, string | undefined> | undefined;
    const searchQuery = qs?.q || '';
    const category = qs?.category;
    const location = qs?.location;
    const limit = parseInt(qs?.limit || '20', 10);
    const userCoords = await resolveSearchUserCoords(qs);

    const explicitCategory = resolveEffectiveSearchCategory(category);
    const taxonomy = searchQuery.trim()
      ? await resolveSearchTaxonomy(searchQuery)
      : {
          categories: [],
          topHubSlug: null,
          topMatchedPhrase: null,
          source: 'none' as const,
        };
    const taxonomyHub =
      !explicitCategory && taxonomy.topHubSlug ? taxonomy.topHubSlug : undefined;
    const effectiveCategory = explicitCategory ?? taxonomyHub;
    const categorySource: CategorySource = explicitCategory
      ? 'explicit'
      : taxonomyHub
        ? 'taxonomy'
        : 'none';
    const hubFromTaxonomy = categorySource === 'taxonomy';
    const residual = buildResidualSearchText(searchQuery, {
      categorySource,
      topHubSlug: taxonomy.topHubSlug,
      topMatchedPhrase: taxonomy.topMatchedPhrase,
    });
    const hubContext = hubSlugToDiscoveryContext(effectiveCategory);
    const categories = taxonomy.categories;
    const taxonomyMeta = this.taxonomyResponseFields({
      categories,
      taxonomyResolvedHub: taxonomy.topHubSlug,
      taxonomySource: taxonomy.source,
      effectiveCategory,
      categorySource,
      hubDrivenRetrieval: hubFromTaxonomy,
      searchText: residual.searchText,
    });

    const result = await this.searchWithPostgres(
      searchQuery,
      effectiveCategory,
      location,
      limit,
      userCoords,
      qs,
      hubContext,
      taxonomyMeta,
      residual.tokens
    );
    logSearchTaxonomyDebug({
      query: searchQuery,
      categories,
      topHubSlug: taxonomy.topHubSlug,
      explicitCategory,
      effectiveCategory,
      categorySource,
      searchMethod: 'sql',
      taxonomySource: taxonomy.source,
      hubDrivenRetrieval: hubFromTaxonomy,
      searchText: residual.searchText,
      searchTokens: residual.tokens,
    });
    return result;
  }

  /**
   * Search using PostgreSQL
   * LIVE STATUS: Only returns vendors that meet live eligibility criteria
   */
  private async searchWithPostgres(
    searchQuery: string,
    category: string | undefined,
    location: string | undefined,
    limit: number,
    userCoords: { lat: number; lng: number } | null,
    qs: Record<string, string | undefined> | undefined,
    hubContext: ReturnType<typeof hubSlugToDiscoveryContext>,
    taxonomyMeta: Record<string, unknown>,
    keywordTokens: string[]
  ): Promise<HandlerResponse> {
    const isBrowseAll = !searchQuery.trim() && !category;

    // ✅ SQL: Search vendors and services
    // ✅ LIVE STATUS FILTER: Only show vendors that are eligible for listing
    // Criteria: active+approved, has at least 1 enabled+published service, has schedule.
    // Geo is optional at SQL fetch time; when hub + coords are present, post-fetch parity
    // removes out-of-radius vendors (same as discover-services), not only distanceKm labels.
    let vendorAvailabilitySql = isBrowseAll
      ? ''
      : `AND ${sqlVendorAvailabilityOrNotConfigured('v')}`;

    let vendorsQuery = `
      SELECT v.*, 
             (SELECT rn.name FROM roles rn WHERE rn.id = v.role_id LIMIT 1) AS search_role_name,
             (SELECT COUNT(*) FROM bookings b WHERE b.vendor_id = v.id AND b.status = 'completed') as completed_bookings,
             (SELECT AVG(rating) FROM reviews r WHERE r.vendor_id = v.id) as avg_rating
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.is_active = true 
        AND ${sqlVendorDiscoverableStatus('v')}
        AND ${sqlVendorOnlineForCustomerDiscovery('v')}
    `;

    const params: any[] = [];
    let paramIndex = 1;

    const hubBrowseOnly = isHubBrowseCategoryOnly(
      category,
      keywordTokens.length > 0 ? keywordTokens.join(' ') : ''
    );

    const useFts = process.env.SEARCH_USE_FTS === 'true';
    let ftsIds: SearchEntityIds | null = null;
    if (useFts && keywordTokens.length > 0) {
      ftsIds = await resolveSearchEntityIds(keywordTokens);
    }
    const ftsActive = ftsIds != null && hasFtsEntityIds(ftsIds);

    if (ftsActive && ftsIds) {
      const vendorFtsClauses: string[] = [];
      if (ftsIds.vendorIds.length > 0) {
        vendorFtsClauses.push(`v.id = ANY($${paramIndex}::uuid[])`);
        params.push(ftsIds.vendorIds);
        paramIndex++;
      }
      if (ftsIds.serviceIds.length > 0) {
        vendorFtsClauses.push(
          `EXISTS (SELECT 1 FROM vendor_services vs_fts WHERE vs_fts.vendor_id = v.id AND vs_fts.id = ANY($${paramIndex}::uuid[]))`
        );
        params.push(ftsIds.serviceIds);
        paramIndex++;
      }
      if (vendorFtsClauses.length > 0) {
        vendorsQuery += ` AND (${vendorFtsClauses.join(' OR ')})`;
      }
    } else {
      for (const token of keywordTokens) {
        vendorsQuery += ` AND (
        v.business_name ILIKE $${paramIndex} OR
        v.owner_name ILIKE $${paramIndex} OR
        v.specialization ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM vendor_services vs_kw
          WHERE vs_kw.vendor_id = v.id
            AND ${sqlVendorServiceDiscoverable('vs_kw', false)}
            AND (
              vs_kw.service_name ILIKE $${paramIndex}
              OR COALESCE(vs_kw.custom_description, '') ILIKE $${paramIndex}
              OR COALESCE(vs_kw.sub_category, '') ILIKE $${paramIndex}
              OR COALESCE(vs_kw.category, '') ILIKE $${paramIndex}
            )
        )
      )`;
        params.push(`%${token}%`);
        paramIndex++;
      }
    }

    const vendorCategoryValues = expandSearchCategoryForSql(category);
    const vendorIlikePatterns = hubBrowseOnly ? [] : getSearchCategoryIlikePatterns(category);

    const appendDiscoveryExists = async (discoverCategory: string, discoverRoleId?: string) => {
      const ctx = hubSlugToDiscoveryContext(discoverCategory);
      const built = await buildDiscoveryVendorExistsSql({
        category: discoverCategory,
        roleId: discoverRoleId ?? qs?.roleId?.trim() ?? ctx?.roleId,
        serviceStyle: ctx?.serviceStyle ?? 'at_center',
        sittingRelaxed: ctx?.sittingDiscoveryRelaxed,
        paramOffset: paramIndex,
        isAtCenter: ctx?.serviceStyle === 'at_center',
        // Intentionally NOT setting strictHubBrowse: search must include the
        // SAME vendors that discover-services (home) includes. discover uses the
        // broad walkerCategoryDiscoveryOr (e.g. a vet/sitter with a dog-walk
        // service appears in the walker hub); search must mirror that, then let
        // radius/availability filters prune. Without parity here, search shows
        // a different (smaller or larger) count than home for the same chip.
      });
      vendorsQuery += ` AND ${built.sql}`;
      vendorAvailabilitySql = built.availabilitySql;
      params.push(...built.params);
      paramIndex += built.params.length;
    };

    if (hubBrowseOnly && category) {
      await appendDiscoveryExists(
        hubContext?.discoverCategory ?? category,
        hubContext?.roleId
      );
    } else if (vendorCategoryValues.length || vendorIlikePatterns.length) {
      const exactArr = vendorCategoryValues.length ? vendorCategoryValues : ['__no_match__'];
      const ilikeArr = vendorIlikePatterns.length ? vendorIlikePatterns : ['__no_match__'];
      vendorsQuery += ` AND (
        EXISTS (
          SELECT 1 FROM vendor_services vscat
          WHERE vscat.vendor_id = v.id
            AND vscat.is_enabled = true
            AND vscat.publish_status IN ('published', 'auto_published')
            AND (
              LOWER(TRIM(COALESCE(vscat.category, ''))) = ANY($${paramIndex}::text[])
              OR vscat.category ILIKE ANY($${paramIndex + 1}::text[])
              OR vscat.service_name ILIKE ANY($${paramIndex + 1}::text[])
              OR COALESCE(vscat.sub_category, '') ILIKE ANY($${paramIndex + 1}::text[])
            )
        )
        OR (
          v.category IS NOT NULL
          AND (
            LOWER(TRIM(COALESCE(v.category, ''))) = ANY($${paramIndex}::text[])
            OR v.category ILIKE ANY($${paramIndex + 1}::text[])
          )
        )
      )`;
      params.push(exactArr);
      params.push(ilikeArr);
      paramIndex += 2;
    }

    if (location) {
      vendorsQuery += ` AND v.city ILIKE $${paramIndex}`;
      params.push(`%${location}%`);
      paramIndex++;
    }

    if (hubContext && !hubBrowseOnly && category) {
      await appendDiscoveryExists(
        hubContext.discoverCategory,
        hubContext.roleId
      );
    }

    vendorsQuery += `${vendorAvailabilitySql}`;
    vendorsQuery += ` ORDER BY avg_rating DESC NULLS LAST, completed_bookings DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows: vendors } = await query(vendorsQuery, params);
    const vendorIdsForServices = vendors.map((v: { id: string }) => v.id);

    // ✅ SQL: Search services
    // ✅ LIVE STATUS FILTER: Only show services from live-eligible vendors
    // Geo is intentionally not required here — see vendorsQuery comment above.
    let servicesQuery = `
      SELECT vs.*,
        v.business_name,
        v.owner_name,
        v.city,
        v.state,
        v.profile_image AS vendor_profile_image,
        v.profile_photo_url AS vendor_profile_photo_url,
        v.metadata AS vendor_metadata,
        v.vendor_type AS vendor_vendor_type,
        v.address AS vendor_address,
        v.landmark AS vendor_landmark,
        v.pincode AS vendor_pincode,
        v.latitude AS vendor_latitude,
        v.longitude AS vendor_longitude,
        (SELECT rn.name FROM roles rn WHERE rn.id = v.role_id LIMIT 1) AS search_role_name
      FROM vendor_services vs
      JOIN vendors v ON vs.vendor_id = v.id
      WHERE ${sqlVendorServiceDiscoverable('vs', !!hubContext?.sittingDiscoveryRelaxed)}
        AND v.is_active = true
        AND ${sqlVendorDiscoverableStatus('v')}
        AND ${sqlVendorOnlineForCustomerDiscovery('v')}
        AND (
          $1::boolean = true
          OR ${sqlVendorAvailabilityOrNotConfigured('v')}
        )
    `;

    const serviceParams: any[] = [isBrowseAll];
    let serviceParamIndex = 2;

    if (ftsActive && ftsIds) {
      const serviceFtsClauses: string[] = [];
      if (ftsIds.serviceIds.length > 0) {
        serviceFtsClauses.push(`vs.id = ANY($${serviceParamIndex}::uuid[])`);
        serviceParams.push(ftsIds.serviceIds);
        serviceParamIndex++;
      }
      if (ftsIds.vendorIds.length > 0) {
        serviceFtsClauses.push(`v.id = ANY($${serviceParamIndex}::uuid[])`);
        serviceParams.push(ftsIds.vendorIds);
        serviceParamIndex++;
      }
      if (serviceFtsClauses.length > 0) {
        servicesQuery += ` AND (${serviceFtsClauses.join(' OR ')})`;
      }
    } else {
      for (const token of keywordTokens) {
        servicesQuery += ` AND (
        vs.service_name ILIKE $${serviceParamIndex}
        OR COALESCE(vs.custom_description, '') ILIKE $${serviceParamIndex}
        OR COALESCE(vs.sub_category, '') ILIKE $${serviceParamIndex}
        OR COALESCE(vs.category, '') ILIKE $${serviceParamIndex}
      )`;
        serviceParams.push(`%${token}%`);
        serviceParamIndex++;
      }
    }

    if ((hubBrowseOnly || (hubContext && category)) && vendorIdsForServices.length > 0) {
      servicesQuery += ` AND v.id = ANY($${serviceParamIndex}::uuid[])`;
      serviceParams.push(vendorIdsForServices);
      serviceParamIndex++;
    }

    servicesQuery += ` LIMIT $${serviceParamIndex}`;
    serviceParams.push(limit);

    const { rows: services } =
      (hubBrowseOnly || (hubContext && category)) && vendorIdsForServices.length === 0
        ? { rows: [] as Record<string, unknown>[] }
        : await query(servicesQuery, serviceParams);

    const vendorRows = await Promise.all(
      vendors.map(async (v) => {
        const profileImage = await getVendorListingPhotoUrl(v as Record<string, unknown>);
        return { v, profileImage };
      })
    );

    const serviceRows = await Promise.all(
      services.map(async (s) => {
        const vendorForPhoto: Record<string, unknown> = {
          profile_photo_url: s.vendor_profile_photo_url,
          profile_image: s.vendor_profile_image,
          metadata: s.vendor_metadata,
          vendor_type: s.vendor_vendor_type,
          logo_url: s.vendor_logo_url ?? s.logo_url,
        };
        const vendorProfileImage = await getVendorListingPhotoUrl(vendorForPhoto);
        return { s, vendorProfileImage };
      })
    );

    const mappedVendors = vendorRows.map(({ v, profileImage }) => {
        const vlat =
          v.latitude != null && String(v.latitude).trim() !== ''
            ? (() => {
                const n = parseFloat(String(v.latitude));
                return Number.isFinite(n) ? n : null;
              })()
            : null;
        const vlng =
          v.longitude != null && String(v.longitude).trim() !== ''
            ? (() => {
                const n = parseFloat(String(v.longitude));
                return Number.isFinite(n) ? n : null;
              })()
            : null;
        let distanceKm: number | null = null;
        if (userCoords && vlat != null && vlng != null) {
          distanceKm = haversineKm(userCoords.lat, userCoords.lng, vlat, vlng);
        }
        return {
          id: v.id,
          businessName: v.business_name,
          ownerName: v.owner_name,
          category: v.category ?? v.search_role_name ?? null,
          city: v.city,
          state: v.state,
          rating: parseFloat(v.avg_rating) || 0,
          completedBookings: parseInt(v.completed_bookings) || 0,
          profileImage,
          address: v.address ?? null,
          landmark: v.landmark ?? null,
          pincode: v.pincode ?? null,
          latitude: vlat,
          longitude: vlng,
          distanceKm,
          is_online: v.is_online,
        };
      });

    const mappedServices = serviceRows.map(({ s, vendorProfileImage }) => {
        const svcVlat =
          s.vendor_latitude != null && String(s.vendor_latitude).trim() !== ''
            ? (() => {
                const n = parseFloat(String(s.vendor_latitude));
                return Number.isFinite(n) ? n : null;
              })()
            : null;
        const svcVlng =
          s.vendor_longitude != null && String(s.vendor_longitude).trim() !== ''
            ? (() => {
                const n = parseFloat(String(s.vendor_longitude));
                return Number.isFinite(n) ? n : null;
              })()
            : null;
        let distanceKm: number | null = null;
        if (userCoords && svcVlat != null && svcVlng != null) {
          distanceKm = haversineKm(userCoords.lat, userCoords.lng, svcVlat, svcVlng);
        }
        return {
          id: s.id,
          serviceName: s.service_name,
          description:
            s.custom_description || s.service_description || s.description_text || s.service_name,
          price: s.price,
          vendorId: s.vendor_id,
          vendorName: s.business_name,
          city: s.city,
          state: s.state,
          category: s.category ?? s.search_role_name ?? null,
          serviceType: s.category ?? s.search_role_name ?? null,
          imageUrl: s.image_url ?? s.thumbnail_url ?? null,
          vendorProfileImage,
          vendorAddress: s.vendor_address ?? null,
          vendorLandmark: s.vendor_landmark ?? null,
          vendorPincode: s.vendor_pincode ?? null,
          vendorLatitude: svcVlat,
          vendorLongitude: svcVlng,
          distanceKm,
        };
      });

    const parity = await applySearchDiscoveryParity({
      vendors: mappedVendors,
      services: mappedServices,
      category,
      searchQuery,
      queryString: qs,
    });

    let finalVendors = parity.vendors;
    let finalServices = parity.services;
    if (hubContext) {
      const styles = acceptableStylesForService(hubContext.serviceStyle);
      finalVendors = await gateVendorsByListableService(parity.vendors, styles, {
        sittingRelaxed: !!hubContext.sittingDiscoveryRelaxed,
      });
      const keptIds = new Set(finalVendors.map((v) => String(v.id)));
      finalServices = filterServicesToKeptVendors(parity.services, keptIds);
    }

    // Query ecommerce products for shop/pharmacy hub searches.
    const finalProducts = isProductSearchHub(category)
      ? await queryProductsForSearch(
          keywordTokens,
          Math.min(limit, 20),
          ftsActive && ftsIds?.productIds.length ? ftsIds.productIds : undefined
        )
      : [];

    // Hub-browse fallback: taxonomy resolved a hub but no results matched the text tokens.
    // Re-run as pure hub browse (drop text tokens) so users never see "No Results Found"
    // when a valid service category exists.
    const sqlCategorySource = (taxonomyMeta as any).categorySource as CategorySource;
    if (
      finalVendors.length === 0 &&
      finalServices.length === 0 &&
      finalProducts.length === 0 &&
      sqlCategorySource === 'taxonomy' &&
      keywordTokens.length > 0
    ) {
      return this.searchWithPostgres(
        searchQuery, category, location, limit, userCoords, qs, hubContext, taxonomyMeta, []
      );
    }

    return this.success({
      query: searchQuery,
      ...taxonomyMeta,
      vendors: finalVendors,
      services: finalServices,
      products: finalProducts,
      total: finalVendors.length + finalServices.length + finalProducts.length,
      searchMethod: 'sql',
      discoveryParity: parity.discoveryApplied,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerSearchEndpoints(app: Hono) {
  const searchHandler = new UniversalSearchHandler();

  app.get('/search', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await searchHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/search/autocomplete', async (c) => {
    try {
      const term = (c.req.query('q') || '').trim();
      if (term.length < 2) {
        return c.json({ success: true, suggestions: [] });
      }

      const { rows } = await query(
        `SELECT keyword, hub_slug
         FROM search_taxonomy_keywords
         WHERE keyword_normalized ILIKE $1 AND is_active = true
         LIMIT 8`,
        [term.toLowerCase() + '%']
      );

      const suggestions = (rows as { keyword: string; hub_slug: string }[]).map((row) => ({
        type: row.hub_slug,
        text: row.keyword,
      }));

      return c.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('[search/autocomplete] Error:', error);
      return c.json({ success: true, suggestions: [] });
    }
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'search-handler',
    functionVersion: '$LATEST',
  };
}

