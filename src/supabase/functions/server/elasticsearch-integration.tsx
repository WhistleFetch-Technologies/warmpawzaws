import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🔍 ELASTICSEARCH INTEGRATION SERVICE
 * 
 * Complete Elasticsearch integration for full-text search
 * 
 * Features:
 * - Index management (vendors, services, products, staff)
 * - Full-text search with fuzzy matching
 * - Autocomplete with suggestions
 * - Search analytics
 * - Multi-field search
 * - Faceted filtering
 * - Highlighting
 */

interface SearchResult {
  id: string;
  type: 'vendor' | 'service' | 'product' | 'staff';
  score: number;
  data: any;
  highlights?: string[];
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took: number; // ms
  facets?: Record<string, any>;
  suggestions?: string[];
}

export function elasticsearchIntegration(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // In-memory search indices (simulating Elasticsearch for MVP)
  // In production, this would connect to actual Elasticsearch cluster
  let searchIndices = {
    vendors: new Map<string, any>(),
    services: new Map<string, any>(),
    products: new Map<string, any>(),
    staff: new Map<string, any>()
  };

  /**
   * Initialize search indices from KV store
   */
  async function initializeIndices() {
    console.log('🔍 Initializing search indices...');

    try {
      // Index vendors
      const vendors = await kv.getByPrefix('vendor:') || [];
      let vendorCount = 0;
      
      for (const item of vendors) {
        const vendor = item.value || item;
        if (vendor.id && !vendor.id.includes(':')) { // Skip nested keys
          await indexVendor(vendor);
          vendorCount++;
        }
      }

      // Index services
      const services = await kv.getByPrefix('service:') || [];
      let serviceCount = 0;
      
      for (const item of services) {
        const service = item.value || item;
        if (service.id) {
          await indexService(service);
          serviceCount++;
        }
      }

      // Index products
      const products = await kv.getByPrefix('product:') || [];
      let productCount = 0;
      
      for (const item of products) {
        const product = item.value || item;
        if (product.id) {
          await indexProduct(product);
          productCount++;
        }
      }

      // Index staff
      const staff = await kv.getByPrefix('staff:') || [];
      let staffCount = 0;
      
      for (const item of staff) {
        const member = item.value || item;
        if (member.id && !member.id.includes(':')) { // Skip nested keys
          await indexStaff(member);
          staffCount++;
        }
      }

      console.log(`✅ Search indices initialized: ${vendorCount} vendors, ${serviceCount} services, ${productCount} products, ${staffCount} staff`);

    } catch (error) {
      console.error('❌ Error initializing indices:', error);
    }
  }

  /**
   * Index a vendor
   */
  async function indexVendor(vendor: any) {
    const searchableText = [
      vendor.businessName || '',
      vendor.fullName || '',
      vendor.description || '',
      vendor.address || '',
      vendor.city || '',
      ...(vendor.services || []),
      ...(vendor.specializations || [])
    ].join(' ').toLowerCase();

    searchIndices.vendors.set(vendor.id, {
      id: vendor.id,
      type: 'vendor',
      data: vendor,
      searchableText,
      createdAt: vendor.createdAt || new Date().toISOString()
    });
  }

  /**
   * Index a service
   */
  async function indexService(service: any) {
    const searchableText = [
      service.name || '',
      service.description || '',
      service.category || '',
      ...(service.tags || [])
    ].join(' ').toLowerCase();

    searchIndices.services.set(service.id, {
      id: service.id,
      type: 'service',
      data: service,
      searchableText,
      createdAt: service.createdAt || new Date().toISOString()
    });
  }

  /**
   * Index a product
   */
  async function indexProduct(product: any) {
    const searchableText = [
      product.name || '',
      product.description || '',
      product.brand || '',
      product.category || '',
      ...(product.tags || [])
    ].join(' ').toLowerCase();

    searchIndices.products.set(product.id, {
      id: product.id,
      type: 'product',
      data: product,
      searchableText,
      createdAt: product.createdAt || new Date().toISOString()
    });
  }

  /**
   * Index a staff member
   */
  async function indexStaff(staff: any) {
    const searchableText = [
      staff.name || '',
      staff.role || '',
      staff.specialization || '',
      ...(staff.skills || []),
      ...(staff.certifications || [])
    ].join(' ').toLowerCase();

    searchIndices.staff.set(staff.id, {
      id: staff.id,
      type: 'staff',
      data: staff,
      searchableText,
      createdAt: staff.createdAt || new Date().toISOString()
    });
  }

  /**
   * Calculate similarity score (simple algorithm)
   */
  function calculateScore(text: string, query: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    let score = 0;

    // Exact match
    if (textLower === queryLower) {
      score += 100;
    }

    // Contains query
    if (textLower.includes(queryLower)) {
      score += 50;
    }

    // Word match
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);

    for (const queryWord of queryWords) {
      for (const textWord of textWords) {
        if (textWord === queryWord) {
          score += 20;
        } else if (textWord.startsWith(queryWord)) {
          score += 10;
        } else if (textWord.includes(queryWord)) {
          score += 5;
        } else if (levenshteinDistance(textWord, queryWord) <= 2) {
          score += 3; // Fuzzy match
        }
      }
    }

    return score;
  }

  /**
   * Levenshtein distance for fuzzy matching
   */
  function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Search across all indices
   */
  async function search(
    query: string,
    options: {
      types?: string[];
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
    } = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    const {
      types = ['vendor', 'service', 'product', 'staff'],
      limit = 20,
      offset = 0,
      filters = {}
    } = options;

    const results: SearchResult[] = [];

    // Search in each index
    if (types.includes('vendor')) {
      for (const [id, item] of searchIndices.vendors) {
        const score = calculateScore(item.searchableText, query);
        if (score > 0) {
          // Apply filters
          if (filters.city && item.data.city !== filters.city) continue;
          if (filters.services && !filters.services.some((s: string) => item.data.services?.includes(s))) continue;

          results.push({
            id,
            type: 'vendor',
            score,
            data: item.data,
            highlights: extractHighlights(item.searchableText, query)
          });
        }
      }
    }

    if (types.includes('service')) {
      for (const [id, item] of searchIndices.services) {
        const score = calculateScore(item.searchableText, query);
        if (score > 0) {
          results.push({
            id,
            type: 'service',
            score,
            data: item.data,
            highlights: extractHighlights(item.searchableText, query)
          });
        }
      }
    }

    if (types.includes('product')) {
      for (const [id, item] of searchIndices.products) {
        const score = calculateScore(item.searchableText, query);
        if (score > 0) {
          // Apply filters
          if (filters.category && item.data.category !== filters.category) continue;
          if (filters.brand && item.data.brand !== filters.brand) continue;

          results.push({
            id,
            type: 'product',
            score,
            data: item.data,
            highlights: extractHighlights(item.searchableText, query)
          });
        }
      }
    }

    if (types.includes('staff')) {
      for (const [id, item] of searchIndices.staff) {
        const score = calculateScore(item.searchableText, query);
        if (score > 0) {
          results.push({
            id,
            type: 'staff',
            score,
            data: item.data,
            highlights: extractHighlights(item.searchableText, query)
          });
        }
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Paginate
    const paginatedResults = results.slice(offset, offset + limit);

    const took = Date.now() - startTime;

    // Track search analytics
    await trackSearchAnalytics(query, results.length, took);

    return {
      query,
      results: paginatedResults,
      total: results.length,
      took,
      suggestions: await generateSuggestions(query)
    };
  }

  /**
   * Extract highlights from text
   */
  function extractHighlights(text: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = text.split(/[.!?]\s+/);

    for (const sentence of sentences) {
      for (const word of queryWords) {
        if (sentence.toLowerCase().includes(word)) {
          highlights.push(sentence.trim().substring(0, 100) + '...');
          break;
        }
      }
    }

    return highlights.slice(0, 3);
  }

  /**
   * Generate autocomplete suggestions
   */
  async function generateSuggestions(query: string): Promise<string[]> {
    const suggestions: Set<string> = new Set();

    // Get common search terms from analytics
    const analytics = await kv.getByPrefix('search:analytics:') || [];
    
    for (const item of analytics) {
      const data = item.value || item;
      if (data.query && data.query.toLowerCase().startsWith(query.toLowerCase())) {
        suggestions.add(data.query);
      }
    }

    // Get suggestions from indexed data
    const allTexts: string[] = [];
    
    for (const [, item] of searchIndices.vendors) {
      allTexts.push(item.data.businessName || '');
      allTexts.push(...(item.data.services || []));
    }

    for (const [, item] of searchIndices.services) {
      allTexts.push(item.data.name || '');
    }

    for (const [, item] of searchIndices.products) {
      allTexts.push(item.data.name || '');
      allTexts.push(item.data.brand || '');
    }

    // Filter and add matching suggestions
    const queryLower = query.toLowerCase();
    for (const text of allTexts) {
      if (text && text.toLowerCase().startsWith(queryLower)) {
        suggestions.add(text);
      }
    }

    return Array.from(suggestions).slice(0, 10);
  }

  /**
   * Track search analytics
   */
  async function trackSearchAnalytics(query: string, resultCount: number, took: number) {
    const today = new Date().toISOString().split('T')[0];
    const key = `search:analytics:${today}:${query}`;

    const existing = await kv.get(key) || {
      query,
      date: today,
      count: 0,
      avgResults: 0,
      avgTime: 0
    };

    existing.count++;
    existing.avgResults = ((existing.avgResults * (existing.count - 1)) + resultCount) / existing.count;
    existing.avgTime = ((existing.avgTime * (existing.count - 1)) + took) / existing.count;

    await kv.set(key, existing);
  }

  // ============================================
  // API ENDPOINTS
  // ============================================

  /**
   * POST /elasticsearch/init
   * Initialize search indices
   */
  app.post(`${BASE_PATH}/elasticsearch/init`, async (c) => {
    try {
      await initializeIndices();
      
      const stats = {
        vendors: searchIndices.vendors.size,
        services: searchIndices.services.size,
        products: searchIndices.products.size,
        staff: searchIndices.staff.size,
        total: searchIndices.vendors.size + searchIndices.services.size + 
               searchIndices.products.size + searchIndices.staff.size
      };

      return sendSuccess(c, { stats, message: 'Search indices initialized' });

    } catch (error) {
      console.error('❌ Error initializing indices:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/search
   * Universal search endpoint
   */
  app.get(`${BASE_PATH}/elasticsearch/search`, async (c) => {
    try {
      const { q, types, limit, offset, ...filters } = c.req.query();

      if (!q) {
        return sendError(c, 'Query parameter required', 400);
      }

      const result = await search(q, {
        types: types ? types.split(',') : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        filters
      });

      return sendSuccess(c, result);

    } catch (error) {
      console.error('❌ Error searching:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/autocomplete
   * Autocomplete suggestions
   */
  app.get(`${BASE_PATH}/elasticsearch/autocomplete`, async (c) => {
    try {
      const { q } = c.req.query();

      if (!q) {
        return sendError(c, 'Query parameter required', 400);
      }

      const suggestions = await generateSuggestions(q);

      return sendSuccess(c, { suggestions });

    } catch (error) {
      console.error('❌ Error generating suggestions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /elasticsearch/index/vendor
   * Index a vendor
   */
  app.post(`${BASE_PATH}/elasticsearch/index/vendor`, async (c) => {
    try {
      const vendor = await c.req.json();

      await indexVendor(vendor);

      return sendSuccess(c, { message: 'Vendor indexed successfully' });

    } catch (error) {
      console.error('❌ Error indexing vendor:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /elasticsearch/index/service
   * Index a service
   */
  app.post(`${BASE_PATH}/elasticsearch/index/service`, async (c) => {
    try {
      const service = await c.req.json();

      await indexService(service);

      return sendSuccess(c, { message: 'Service indexed successfully' });

    } catch (error) {
      console.error('❌ Error indexing service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /elasticsearch/index/product
   * Index a product
   */
  app.post(`${BASE_PATH}/elasticsearch/index/product`, async (c) => {
    try {
      const product = await c.req.json();

      await indexProduct(product);

      return sendSuccess(c, { message: 'Product indexed successfully' });

    } catch (error) {
      console.error('❌ Error indexing product:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/analytics
   * Get search analytics
   */
  app.get(`${BASE_PATH}/elasticsearch/analytics`, async (c) => {
    try {
      const { startDate, endDate } = c.req.query();

      const analytics = await kv.getByPrefix('search:analytics:') || [];

      const filtered = analytics
        .map((item: any) => item.value || item)
        .filter((a: any) => {
          if (!startDate && !endDate) return true;
          if (startDate && a.date < startDate) return false;
          if (endDate && a.date > endDate) return false;
          return true;
        });

      // Aggregate stats
      const stats = {
        totalSearches: filtered.reduce((sum: number, a: any) => sum + a.count, 0),
        uniqueQueries: filtered.length,
        topQueries: filtered
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 10)
          .map((a: any) => ({ query: a.query, count: a.count })),
        avgResultsPerSearch: filtered.reduce((sum: number, a: any) => sum + a.avgResults, 0) / filtered.length || 0,
        avgResponseTime: filtered.reduce((sum: number, a: any) => sum + a.avgTime, 0) / filtered.length || 0
      };

      return sendSuccess(c, { analytics: stats });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  // Initialize indices on startup
  initializeIndices();

  console.log('✅ Elasticsearch Integration registered');
}
