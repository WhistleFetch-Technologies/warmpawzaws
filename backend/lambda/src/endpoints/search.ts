/**
 * ============================================================================
 * SEARCH ENDPOINTS - LAMBDA VERSION WITH OPENSEARCH FALLBACK
 * ============================================================================
 * 
 * Handles search for services and vendors with intelligent fallback:
 * 1. Try OpenSearch (if available)
 * 2. Fall back to PostgreSQL full-text search
 * 
 * - Universal service discovery
 * - Vendor search
 * - Service search
 * - Problem-based discovery
 * 
 * Date: 2025-01-28 (Updated: 2026-01-02)
 * Migration: Supabase to AWS Lambda
 *
 * Service result ids: OpenSearch warmpawz-services documents MUST use vendor_services.id
 * (same as SQL fallback) so customer /booking/:id and GET /services/:id resolve correctly.
 * Canonical service detail for that id: GET /services/:serviceId (service_catalog row first, else vendor_services).
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import {
  expandSearchCategoryForOpenSearch,
  expandSearchCategoryForSql,
  expandSearchCategoryNormalizedTokens,
  getSearchCategoryIlikePatterns,
  isHubBrowseCategoryOnly,
} from '../utils/search-category-aliases';

// Import OpenSearch client with fallback handling
let openSearchClient: any = null;
try {
  const { getOpenSearchClient } = require('../utils/opensearch-client');
  openSearchClient = getOpenSearchClient();
} catch (error) {
  console.warn('⚠️  OpenSearch client not available, will use SQL fallback');
}

/** Whitespace-separated query → tokens (cap avoids huge SQL from pasted text). */
function searchTokens(searchQuery: string, maxTokens = 6): string[] {
  const raw = String(searchQuery || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return raw.slice(0, maxTokens);
}

/** Customer device coordinates (optional query) → distanceKm on vendor/service vendor location. */
function parseUserCoordsFromQuery(qs?: Record<string, string | undefined> | null): {
  lat: number;
  lng: number;
} | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const raw = qs?.[k];
      if (raw == null || raw === '') continue;
      const n = parseFloat(String(raw));
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  };
  const lat = pick('userLat', 'lat', 'latitude');
  const lng = pick('userLng', 'lng', 'lon', 'longitude');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ============================================================================
// SEARCH HANDLERS
// ============================================================================

class UniversalSearchHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const qs = context.event.queryStringParameters as Record<string, string | undefined> | undefined;
    const searchQuery = qs?.q || '';
    const category = qs?.category;
    const location = qs?.location;
    const limit = parseInt(qs?.limit || '20', 10);
    const userCoords = parseUserCoordsFromQuery(qs);

    // Try OpenSearch first if available
    if (openSearchClient && process.env.ENABLE_OPENSEARCH === 'true') {
      try {
        console.log('🔍 Using OpenSearch for search query:', searchQuery);
        return await this.searchWithOpenSearch(
          searchQuery,
          category,
          location,
          limit,
          userCoords
        );
      } catch (error) {
        console.warn('⚠️  OpenSearch failed, falling back to SQL:', error);
        // Fall through to SQL search
      }
    } else {
      console.log('🔍 Using SQL fallback for search query:', searchQuery);
    }

    // ✅ SQL Fallback: Search vendors and services using PostgreSQL
    return await this.searchWithSQL(searchQuery, category, location, limit, userCoords);
  }

  /**
   * Search using OpenSearch (primary method)
   */
  private async searchWithOpenSearch(
    searchQuery: string,
    category: string | undefined,
    location: string | undefined,
    limit: number,
    userCoords: { lat: number; lng: number } | null
  ): Promise<HandlerResponse> {
    const searchBody: any = {
      query: {
        bool: {
          must: [],
          filter: [],
        },
      },
      size: limit,
    };

    // Text + category: require keyword match AND hub category (same as SQL AND semantics).
    if (searchQuery) {
      searchBody.query.bool.must.push({
        multi_match: {
          query: searchQuery,
          fields: ['business_name^3', 'service_name^2', 'description', 'specialization'],
          fuzziness: 'AUTO' as const,
        },
      });
    }

    // Add category filter (UI slug → multiple DB role/category strings)
    const categoryTerms = expandSearchCategoryForOpenSearch(category);
    if (categoryTerms?.length) {
      searchBody.query.bool.filter.push({ terms: { category: categoryTerms } });
    }

    // Add location filter
    if (location) {
      searchBody.query.bool.filter.push({ term: { city: location.toLowerCase() } });
    }

    // Add status filters
    searchBody.query.bool.filter.push({ term: { is_active: true } });
    searchBody.query.bool.filter.push({ term: { status: 'approved' } });

    const result = await openSearchClient.search({
      index: 'warmpawz-vendors,warmpawz-services',
      body: searchBody,
    });

    const hits = result.body.hits.hits;
    const vendors: any[] = [];
    const services: any[] = [];

    hits.forEach((hit: any) => {
      const source = hit._source;
      if (hit._index.includes('vendors')) {
        const loc = source.location;
        const latRaw =
          loc != null && typeof loc === 'object'
            ? parseFloat(String((loc as any).lat ?? (loc as any).latitude ?? ''))
            : source.latitude != null
              ? parseFloat(String(source.latitude))
              : NaN;
        const lngRaw =
          loc != null && typeof loc === 'object'
            ? parseFloat(String((loc as any).lon ?? (loc as any).lng ?? (loc as any).longitude ?? ''))
            : source.longitude != null
              ? parseFloat(String(source.longitude))
              : NaN;
        const lat = Number.isFinite(latRaw) ? latRaw : NaN;
        const lng = Number.isFinite(lngRaw) ? lngRaw : NaN;
        const vlat = Number.isFinite(lat) ? lat : null;
        const vlng = Number.isFinite(lng) ? lng : null;
        let distanceKm: number | null = null;
        if (userCoords && vlat != null && vlng != null) {
          distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, vlat, vlng);
        }
        vendors.push({
          id: source.id,
          businessName: source.business_name,
          ownerName: source.owner_name,
          category: source.category ?? source.role ?? source.role_name ?? null,
          city: source.city,
          state: source.state,
          rating: source.rating || 0,
          completedBookings: source.completed_bookings || 0,
          profileImage: source.profile_image ?? source.profileImage,
          address: source.address,
          landmark: source.landmark,
          pincode: source.pincode,
          latitude: vlat,
          longitude: vlng,
          distanceKm,
        });
      } else {
        const sloc = source.location;
        const slatRaw =
          sloc != null && typeof sloc === 'object'
            ? parseFloat(String((sloc as any).lat ?? (sloc as any).latitude ?? ''))
            : source.vendor_latitude != null
              ? parseFloat(String(source.vendor_latitude))
              : NaN;
        const slngRaw =
          sloc != null && typeof sloc === 'object'
            ? parseFloat(String((sloc as any).lon ?? (sloc as any).lng ?? (sloc as any).longitude ?? ''))
            : source.vendor_longitude != null
              ? parseFloat(String(source.vendor_longitude))
              : NaN;
        const slat = Number.isFinite(slatRaw) ? slatRaw : NaN;
        const slng = Number.isFinite(slngRaw) ? slngRaw : NaN;
        const svcVlat = Number.isFinite(slat) ? slat : null;
        const svcVlng = Number.isFinite(slng) ? slng : null;
        let distanceKm: number | null = null;
        if (userCoords && svcVlat != null && svcVlng != null) {
          distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, svcVlat, svcVlng);
        }
        services.push({
          id: source.id,
          serviceName: source.service_name || source.name,
          description: source.description,
          price: source.price,
          vendorId: source.vendor_id,
          vendorName: source.vendor_name,
          city: source.city,
          state: source.state,
          category: source.category ?? source.service_type,
          imageUrl:
            typeof source.image_url === 'string' ? source.image_url : source.service_image ?? undefined,
          vendorProfileImage: source.vendor_profile_image ?? source.vendor_profile_photo,
          vendorAddress: source.vendor_address ?? source.address,
          vendorLandmark: source.vendor_landmark ?? source.landmark,
          vendorPincode: source.vendor_pincode ?? source.pincode,
          vendorLatitude: svcVlat,
          vendorLongitude: svcVlng,
          distanceKm,
        });
      }
    });

    return this.success({
      query: searchQuery,
      vendors,
      services,
      total: hits.length,
      searchMethod: 'opensearch',
    });
  }

  /**
   * Search using SQL (fallback method)
   * ✅ LIVE STATUS: Only returns vendors that meet live eligibility criteria
   */
  private async searchWithSQL(
    searchQuery: string,
    category: string | undefined,
    location: string | undefined,
    limit: number,
    userCoords: { lat: number; lng: number } | null
  ): Promise<HandlerResponse> {
    const isBrowseAll = !searchQuery.trim() && !category;

    // ✅ SQL: Search vendors and services
    // ✅ LIVE STATUS FILTER: Only show vendors that are eligible for listing
    // Criteria: active+approved, has at least 1 enabled+published service, has schedule.
    // NOTE: latitude/longitude are NOT required at the base filter — many real prod
    // vendors are onboarded before geo is captured. Geo is applied as an extra filter
    // only when a `lat`/`lng` query param is provided (distance-bounded search).
    let vendorsQuery = `
      SELECT v.*, 
             (SELECT rn.name FROM roles rn WHERE rn.id = v.role_id LIMIT 1) AS search_role_name,
             (SELECT COUNT(*) FROM bookings b WHERE b.vendor_id = v.id AND b.status = 'completed') as completed_bookings,
             (SELECT AVG(rating) FROM reviews r WHERE r.vendor_id = v.id) as avg_rating
      FROM vendors v
      WHERE v.is_active = true 
        AND v.status = 'approved'
        AND EXISTS (
          SELECT 1 FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.is_enabled = true 
            AND vs.publish_status IN ('published', 'auto_published')
        )
        AND (
          $1::boolean = true
          OR EXISTS (
            SELECT 1 FROM vendor_availability_v2 va
            WHERE va.vendor_id = v.id
               OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)
          )
        )
    `;

    const params: any[] = [isBrowseAll];
    let paramIndex = 2;

    const keywordTokens = searchQuery.trim() ? searchTokens(searchQuery) : [];
    const hubBrowseOnly = isHubBrowseCategoryOnly(category, searchQuery);
    const normalizedHubTokens = hubBrowseOnly ? expandSearchCategoryNormalizedTokens(category) : [];

    // Keyword: each token must match vendor fields OR any listable published service on that vendor.
    for (const token of keywordTokens) {
      vendorsQuery += ` AND (
        v.business_name ILIKE $${paramIndex} OR
        v.owner_name ILIKE $${paramIndex} OR
        v.specialization ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM vendor_services vs_kw
          WHERE vs_kw.vendor_id = v.id
            AND vs_kw.is_enabled = true
            AND vs_kw.publish_status IN ('published', 'auto_published')
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

    const vendorCategoryValues = expandSearchCategoryForSql(category);
    const vendorIlikePatterns = hubBrowseOnly ? [] : getSearchCategoryIlikePatterns(category);
    if (hubBrowseOnly && normalizedHubTokens.length) {
      vendorsQuery += ` AND (
        EXISTS (
          SELECT 1 FROM vendor_services vscat
          WHERE vscat.vendor_id = v.id
            AND vscat.is_enabled = true
            AND vscat.publish_status IN ('published', 'auto_published')
            AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(vscat.category, '')), '[[:space:]-]+', '_', 'g')) = ANY($${paramIndex}::text[])
        )
        OR (
          v.category IS NOT NULL
          AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(v.category, '')), '[[:space:]-]+', '_', 'g')) = ANY($${paramIndex}::text[])
        )
        OR EXISTS (
          SELECT 1 FROM roles r_hub
          WHERE r_hub.id = v.role_id
            AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(r_hub.name, '')), '[[:space:]-]+', '_', 'g')) = ANY($${paramIndex}::text[])
        )
      )`;
      params.push(normalizedHubTokens);
      paramIndex += 1;
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
      // Simple location filtering - in production, use geospatial queries
      vendorsQuery += ` AND v.city ILIKE $${paramIndex}`;
      params.push(`%${location}%`);
      paramIndex++;
    }

    vendorsQuery += ` ORDER BY avg_rating DESC NULLS LAST, completed_bookings DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows: vendors } = await query(vendorsQuery, params);

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
        v.address AS vendor_address,
        v.landmark AS vendor_landmark,
        v.pincode AS vendor_pincode,
        v.latitude AS vendor_latitude,
        v.longitude AS vendor_longitude,
        (SELECT rn.name FROM roles rn WHERE rn.id = v.role_id LIMIT 1) AS search_role_name
      FROM vendor_services vs
      JOIN vendors v ON vs.vendor_id = v.id
      WHERE vs.publish_status IN ('published', 'auto_published')
        AND vs.is_enabled = true
        AND v.is_active = true
        AND v.status = 'approved'
        AND (
          $1::boolean = true
          OR EXISTS (
            SELECT 1 FROM vendor_availability_v2 va
            WHERE va.vendor_id = v.id
               OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)
          )
        )
    `;

    const serviceParams: any[] = [isBrowseAll];
    let serviceParamIndex = 2;

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

    const serviceCategoryValues = expandSearchCategoryForSql(category);
    const serviceIlikePatterns = hubBrowseOnly ? [] : getSearchCategoryIlikePatterns(category);
    if (hubBrowseOnly && normalizedHubTokens.length) {
      servicesQuery += ` AND (
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(vs.category, '')), '[[:space:]-]+', '_', 'g')) = ANY($${serviceParamIndex}::text[])
        OR EXISTS (
          SELECT 1 FROM roles r_svc
          WHERE r_svc.id = v.role_id
            AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(r_svc.name, '')), '[[:space:]-]+', '_', 'g')) = ANY($${serviceParamIndex}::text[])
        )
      )`;
      serviceParams.push(normalizedHubTokens);
      serviceParamIndex += 1;
    } else if (serviceCategoryValues.length || serviceIlikePatterns.length) {
      const exactSvcArr = serviceCategoryValues.length ? serviceCategoryValues : ['__no_match__'];
      const ilikeSvcArr = serviceIlikePatterns.length ? serviceIlikePatterns : ['__no_match__'];
      servicesQuery += ` AND (
        LOWER(TRIM(COALESCE(vs.category, ''))) = ANY($${serviceParamIndex}::text[])
        OR vs.category ILIKE ANY($${serviceParamIndex + 1}::text[])
        OR vs.service_name ILIKE ANY($${serviceParamIndex + 1}::text[])
        OR COALESCE(vs.sub_category, '') ILIKE ANY($${serviceParamIndex + 1}::text[])
      )`;
      serviceParams.push(exactSvcArr);
      serviceParams.push(ilikeSvcArr);
      serviceParamIndex += 2;
    }

    servicesQuery += ` LIMIT $${serviceParamIndex}`;
    serviceParams.push(limit);

    const { rows: services } = await query(servicesQuery, serviceParams);

    return this.success({
      query: searchQuery,
      vendors: vendors.map(v => {
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
          distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, vlat, vlng);
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
          profileImage: v.profile_image ?? null,
          address: v.address ?? null,
          landmark: v.landmark ?? null,
          pincode: v.pincode ?? null,
          latitude: vlat,
          longitude: vlng,
          distanceKm,
        };
      }),
      services: services.map(s => {
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
          distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, svcVlat, svcVlng);
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
          vendorProfileImage: s.vendor_profile_image ?? null,
          vendorAddress: s.vendor_address ?? null,
          vendorLandmark: s.vendor_landmark ?? null,
          vendorPincode: s.vendor_pincode ?? null,
          vendorLatitude: svcVlat,
          vendorLongitude: svcVlng,
          distanceKm,
        };
      }),
      total: vendors.length + services.length,
      searchMethod: 'sql-fallback',
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

