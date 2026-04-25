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
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { CATEGORY_ROLES } from './customer/constants/index';

// Import OpenSearch client with fallback handling
let openSearchClient: any = null;
try {
  const { getOpenSearchClient } = require('../utils/opensearch-client');
  openSearchClient = getOpenSearchClient();
} catch (error) {
  console.warn('⚠️  OpenSearch client not available, will use SQL fallback');
}

/**
 * Customer /search UI sends hub slugs (vet, grooming, walker, …).
 * `vendors.category` / `vendor_services.category` store role-style strings; values may differ in case.
 */
function expandCategoryBucket(slug: string | undefined): string[] | undefined {
  if (!slug) return undefined;
  const raw = new Set<string>();
  raw.add(slug);
  (CATEGORY_ROLES[slug] || []).forEach((m) => raw.add(m));
  const list = Array.from(raw)
    .map((s) => String(s).trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function expandCategoryLower(slug: string | undefined): string[] | undefined {
  const list = expandCategoryBucket(slug);
  if (!list?.length) return undefined;
  return Array.from(new Set(list.map((v) => v.toLowerCase())));
}

/** OpenSearch keyword field may be indexed with mixed case — send both forms. */
function expandCategoryTermsAnyCase(slug: string | undefined): string[] | undefined {
  const list = expandCategoryBucket(slug);
  if (!list?.length) return undefined;
  const out = new Set<string>();
  for (const v of list) {
    out.add(v);
    out.add(v.toLowerCase());
  }
  return Array.from(out);
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

// ============================================================================
// SEARCH HANDLERS
// ============================================================================

class UniversalSearchHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const searchQuery = context.event.queryStringParameters?.q || '';
    const category = context.event.queryStringParameters?.category;
    const location = context.event.queryStringParameters?.location;
    const limit = parseInt(context.event.queryStringParameters?.limit || '20', 10);

    if (!searchQuery && !category) {
      return this.error('Search query or category is required', 400);
    }

    // Try OpenSearch first if available
    if (openSearchClient && process.env.ENABLE_OPENSEARCH === 'true') {
      try {
        console.log('🔍 Using OpenSearch for search query:', searchQuery);
        return await this.searchWithOpenSearch(searchQuery, category, location, limit);
      } catch (error) {
        console.warn('⚠️  OpenSearch failed, falling back to SQL:', error);
        // Fall through to SQL search
      }
    } else {
      console.log('🔍 Using SQL fallback for search query:', searchQuery);
    }

    // ✅ SQL Fallback: Search vendors and services using PostgreSQL
    return await this.searchWithSQL(searchQuery, category, location, limit);
  }

  /**
   * Search using OpenSearch (primary method)
   */
  private async searchWithOpenSearch(
    searchQuery: string,
    category: string | undefined,
    location: string | undefined,
    limit: number
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
    const categoryTerms = expandCategoryTermsAnyCase(category);
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
        vendors.push({
          id: source.id,
          businessName: source.business_name,
          ownerName: source.owner_name,
          category: source.category,
          city: source.city,
          state: source.state,
          rating: source.rating || 0,
          completedBookings: source.completed_bookings || 0,
        });
      } else {
        services.push({
          id: source.id,
          serviceName: source.service_name || source.name,
          description: source.description,
          price: source.price,
          vendorId: source.vendor_id,
          vendorName: source.vendor_name,
          city: source.city,
          state: source.state,
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
    limit: number
  ): Promise<HandlerResponse> {
    // ✅ SQL: Search vendors and services
    // ✅ LIVE STATUS FILTER: Only show vendors that are eligible for listing
    // Criteria: At least 1 enabled service, has schedule, has location (lat/lng)
    let vendorsQuery = `
      SELECT v.*, 
             (SELECT COUNT(*) FROM bookings b WHERE b.vendor_id = v.id AND b.status = 'completed') as completed_bookings,
             (SELECT AVG(rating) FROM reviews r WHERE r.vendor_id = v.id) as avg_rating
      FROM vendors v
      WHERE v.is_active = true 
        AND v.status = 'approved'
        AND v.latitude IS NOT NULL 
        AND v.longitude IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.is_enabled = true 
            AND vs.publish_status IN ('published', 'auto_published')
        )
        AND EXISTS (
          SELECT 1 FROM vendor_availability_v2 va 
          WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)
        )
    `;

    const params: any[] = [];
    let paramIndex = 1;

    const keywordTokens = searchQuery.trim() ? searchTokens(searchQuery) : [];

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

    const vendorCategoryValues = expandCategoryLower(category);
    if (vendorCategoryValues?.length) {
      // Prefer published service categories — vendors.category is often null or stale.
      vendorsQuery += ` AND (
        EXISTS (
          SELECT 1 FROM vendor_services vscat
          WHERE vscat.vendor_id = v.id
            AND vscat.is_enabled = true
            AND vscat.publish_status IN ('published', 'auto_published')
            AND LOWER(TRIM(COALESCE(vscat.category, ''))) = ANY($${paramIndex}::text[])
        )
        OR (v.category IS NOT NULL AND LOWER(TRIM(COALESCE(v.category, ''))) = ANY($${paramIndex}::text[]))
      )`;
      params.push(vendorCategoryValues);
      paramIndex++;
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
    let servicesQuery = `
      SELECT vs.*, v.business_name, v.owner_name, v.city, v.state
      FROM vendor_services vs
      JOIN vendors v ON vs.vendor_id = v.id
      WHERE vs.publish_status IN ('published', 'auto_published')
        AND vs.is_enabled = true
        AND v.is_active = true
        AND v.status = 'approved'
        AND v.latitude IS NOT NULL 
        AND v.longitude IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM vendor_availability_v2 va 
          WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)
        )
    `;

    const serviceParams: any[] = [];
    let serviceParamIndex = 1;

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

    const serviceCategoryValues = expandCategoryLower(category);
    if (serviceCategoryValues?.length) {
      servicesQuery += ` AND LOWER(TRIM(COALESCE(vs.category, ''))) = ANY($${serviceParamIndex}::text[])`;
      serviceParams.push(serviceCategoryValues);
      serviceParamIndex++;
    }

    servicesQuery += ` LIMIT $${serviceParamIndex}`;
    serviceParams.push(limit);

    const { rows: services } = await query(servicesQuery, serviceParams);

    return this.success({
      query: searchQuery,
      vendors: vendors.map(v => ({
        id: v.id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        category: v.category,
        city: v.city,
        state: v.state,
        rating: parseFloat(v.avg_rating) || 0,
        completedBookings: parseInt(v.completed_bookings) || 0,
      })),
      services: services.map(s => ({
        id: s.id,
        serviceName: s.service_name,
        description:
          s.custom_description || s.service_description || s.description_text || s.service_name,
        price: s.price,
        vendorId: s.vendor_id,
        vendorName: s.business_name,
        city: s.city,
        state: s.state,
        category: s.category,
        serviceType: s.category,
      })),
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

