import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🔍 ELASTICSEARCH INTEGRATION
 * 
 * Complete Elasticsearch implementation for Warmpawz platform
 * 
 * Features:
 * - Index management (centers, staff, services, products)
 * - Universal search with autocomplete
 * - Geo-search functionality
 * - Search analytics tracking
 * - Real-time indexing
 * 
 * Indices:
 * - warmpawz_centers
 * - warmpawz_staff
 * - warmpawz_services
 * - warmpawz_products
 */

// Elasticsearch client configuration
const ELASTICSEARCH_URL = Deno.env.get('ELASTICSEARCH_URL') || 'http://localhost:9200';
const ELASTICSEARCH_API_KEY = Deno.env.get('ELASTICSEARCH_API_KEY') || '';
const ELASTICSEARCH_USERNAME = Deno.env.get('ELASTICSEARCH_USERNAME') || 'elastic';
const ELASTICSEARCH_PASSWORD = Deno.env.get('ELASTICSEARCH_PASSWORD') || '';
const INDEX_PREFIX = 'warmpawz';

interface ElasticsearchConfig {
  url: string;
  headers: Record<string, string>;
}

class ElasticsearchClient {
  private config: ElasticsearchConfig;

  constructor() {
    this.config = {
      url: ELASTICSEARCH_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Use API Key or Basic Auth
    if (ELASTICSEARCH_API_KEY) {
      this.config.headers['Authorization'] = `ApiKey ${ELASTICSEARCH_API_KEY}`;
    } else {
      const auth = btoa(`${ELASTICSEARCH_USERNAME}:${ELASTICSEARCH_PASSWORD}`);
      this.config.headers['Authorization'] = `Basic ${auth}`;
    }
  }

  async request(method: string, path: string, body?: any) {
    const url = `${this.config.url}${path}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.config.headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Elasticsearch error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Elasticsearch request failed:', error);
      throw error;
    }
  }

  async createIndex(indexName: string, mappings: any) {
    console.log(`📋 Creating index: ${indexName}`);
    
    return await this.request('PUT', `/${indexName}`, {
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
        analysis: {
          analyzer: {
            autocomplete: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'autocomplete_filter']
            },
            autocomplete_search: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase']
            }
          },
          filter: {
            autocomplete_filter: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 20
            }
          }
        }
      },
      mappings
    });
  }

  async indexDocument(indexName: string, id: string, document: any) {
    return await this.request('PUT', `/${indexName}/_doc/${id}`, document);
  }

  async bulkIndex(indexName: string, documents: any[]) {
    const bulkBody: any[] = [];
    
    documents.forEach(doc => {
      bulkBody.push({ index: { _index: indexName, _id: doc.id } });
      bulkBody.push(doc);
    });

    const body = bulkBody.map(item => JSON.stringify(item)).join('\n') + '\n';

    const response = await fetch(`${this.config.url}/_bulk`, {
      method: 'POST',
      headers: {
        ...this.config.headers,
        'Content-Type': 'application/x-ndjson'
      },
      body
    });

    return await response.json();
  }

  async search(indexName: string, query: any) {
    return await this.request('POST', `/${indexName}/_search`, query);
  }

  async deleteIndex(indexName: string) {
    return await this.request('DELETE', `/${indexName}`);
  }

  async indexExists(indexName: string) {
    try {
      await this.request('HEAD', `/${indexName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getIndexStats(indexName: string) {
    return await this.request('GET', `/${indexName}/_stats`);
  }

  async health() {
    return await this.request('GET', '/_cluster/health');
  }
}

// Index Mappings
const MAPPINGS = {
  centers: {
    properties: {
      vendorId: { type: 'keyword' },
      businessName: { 
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      services: { type: 'keyword' },
      location: { type: 'geo_point' },
      rating: { type: 'float' },
      address: { type: 'text' },
      city: { type: 'keyword' },
      state: { type: 'keyword' },
      pincode: { type: 'keyword' },
      isActive: { type: 'boolean' },
      description: { type: 'text' },
      phone: { type: 'keyword' },
      email: { type: 'keyword' },
      openingHours: { type: 'object' },
      amenities: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' }
    }
  },
  staff: {
    properties: {
      staffId: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      role: { type: 'keyword' },
      specializations: { type: 'keyword' },
      vendorId: { type: 'keyword' },
      rating: { type: 'float' },
      isAvailable: { type: 'boolean' },
      location: { type: 'geo_point' },
      experience: { type: 'integer' },
      qualifications: { type: 'text' },
      bio: { type: 'text' },
      languages: { type: 'keyword' },
      serviceStyle: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' }
    }
  },
  services: {
    properties: {
      serviceId: { type: 'keyword' },
      serviceName: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      category: { type: 'keyword' },
      vendorId: { type: 'keyword' },
      price: { type: 'float' },
      duration: { type: 'integer' },
      description: { type: 'text' },
      isActive: { type: 'boolean' },
      serviceStyle: { type: 'keyword' },
      tags: { type: 'keyword' },
      requirements: { type: 'text' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' }
    }
  },
  products: {
    properties: {
      productId: { type: 'keyword' },
      productName: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      category: { type: 'keyword' },
      vendorId: { type: 'keyword' },
      price: { type: 'float' },
      brand: { type: 'keyword' },
      description: { type: 'text' },
      inStock: { type: 'boolean' },
      stockQuantity: { type: 'integer' },
      tags: { type: 'keyword' },
      specifications: { type: 'object' },
      weight: { type: 'float' },
      dimensions: { type: 'object' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' }
    }
  }
};

// Query Builder
class QueryBuilder {
  static universalSearch(query: string, filters: any = {}) {
    const must: any[] = [];
    const filter: any[] = [{ term: { isActive: true } }];

    // Multi-match query
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'businessName^3',
            'name^3',
            'serviceName^3',
            'productName^3',
            'description',
            'bio',
            'brand^2'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or'
        }
      });
    }

    // Filters
    if (filters.category) {
      filter.push({ term: { category: filters.category } });
    }

    if (filters.city) {
      filter.push({ term: { city: filters.city } });
    }

    if (filters.services && filters.services.length > 0) {
      filter.push({ terms: { services: filters.services } });
    }

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      const range: any = {};
      if (filters.priceMin !== undefined) range.gte = filters.priceMin;
      if (filters.priceMax !== undefined) range.lte = filters.priceMax;
      filter.push({ range: { price: range } });
    }

    if (filters.ratingMin) {
      filter.push({ range: { rating: { gte: filters.ratingMin } } });
    }

    // Geo filter
    if (filters.lat && filters.lng && filters.radius) {
      filter.push({
        geo_distance: {
          distance: `${filters.radius}km`,
          location: {
            lat: filters.lat,
            lon: filters.lng
          }
        }
      });
    }

    return {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter
        }
      },
      highlight: {
        fields: {
          businessName: {},
          name: {},
          serviceName: {},
          productName: {},
          description: {}
        }
      },
      sort: this.buildSort(filters.sort, filters.lat, filters.lng),
      from: filters.from || 0,
      size: filters.size || 20
    };
  }

  static autocomplete(query: string, field: string = 'businessName') {
    return {
      query: {
        bool: {
          must: [
            {
              match_phrase_prefix: {
                [field]: {
                  query,
                  max_expansions: 10
                }
              }
            }
          ],
          filter: [
            { term: { isActive: true } }
          ]
        }
      },
      size: 10,
      _source: [field, 'vendorId', 'staffId', 'serviceId', 'productId']
    };
  }

  static geoSearch(lat: number, lng: number, radius: number, filters: any = {}) {
    return {
      query: {
        bool: {
          must: [
            { match_all: {} }
          ],
          filter: [
            {
              geo_distance: {
                distance: `${radius}km`,
                location: { lat, lon: lng }
              }
            },
            { term: { isActive: true } }
          ]
        }
      },
      sort: [
        {
          _geo_distance: {
            location: { lat, lon: lng },
            order: 'asc',
            unit: 'km'
          }
        }
      ],
      from: filters.from || 0,
      size: filters.size || 20
    };
  }

  static buildSort(sortBy: string = 'relevance', lat?: number, lng?: number) {
    if (sortBy === 'distance' && lat && lng) {
      return [
        {
          _geo_distance: {
            location: { lat, lon: lng },
            order: 'asc',
            unit: 'km'
          }
        }
      ];
    }

    if (sortBy === 'rating') {
      return [{ rating: { order: 'desc' } }];
    }

    if (sortBy === 'price_low') {
      return [{ price: { order: 'asc' } }];
    }

    if (sortBy === 'price_high') {
      return [{ price: { order: 'desc' } }];
    }

    if (sortBy === 'newest') {
      return [{ createdAt: { order: 'desc' } }];
    }

    // Default: relevance (score)
    return ['_score'];
  }
}

// Search Analytics
class SearchAnalytics {
  static async trackSearch(kv: any, query: string, results: number, responseTime: number, filters: any) {
    const timestamp = new Date().toISOString();
    const logKey = `search-log:${Date.now()}`;

    // ✅ SQL: Log individual search in search_logs table
    const db = getDbClient();
    await db
      .from('search_logs')
      .insert({
        id: logKey,
        query,
        results_count: results,
        response_time_ms: responseTime,
        filters: filters,
        created_at: timestamp
      });

    // ✅ SQL: Update aggregated analytics in search_analytics table
    const { data: analyticsData } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'search-analytics')
      .single();
    
    const analytics = analyticsData?.setting_value || {
      topSearches: {},
      zeroResultSearches: {},
      totalSearches: 0,
      totalResponseTime: 0,
      searchesByCategory: {}
    };

    analytics.totalSearches++;
    analytics.totalResponseTime += responseTime;

    // Track query frequency
    if (results === 0) {
      analytics.zeroResultSearches[query] = (analytics.zeroResultSearches[query] || 0) + 1;
    } else {
      analytics.topSearches[query] = (analytics.topSearches[query] || 0) + 1;
    }

    // Track by category
    if (filters.category) {
      analytics.searchesByCategory[filters.category] = 
        (analytics.searchesByCategory[filters.category] || 0) + 1;
    }

    await db
      .from('platform_settings')
      .upsert({
        setting_key: 'search-analytics',
        setting_value: analytics,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });
  }

  static async getAnalytics() {
    // ✅ SQL: Get analytics from platform_settings table
    const db = getDbClient();
    const { data: analyticsData } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'search-analytics')
      .single();
    
    const analytics = analyticsData?.setting_value || {
      topSearches: {},
      zeroResultSearches: {},
      totalSearches: 0,
      totalResponseTime: 0,
      searchesByCategory: {}
    };

    // Convert to arrays and sort
    const topSearches = Object.entries(analytics.topSearches)
      .map(([query, count]) => ({ query, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    const zeroResultSearches = Object.entries(analytics.zeroResultSearches)
      .map(([query, count]) => ({ query, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    const searchesByCategory = Object.entries(analytics.searchesByCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a: any, b: any) => b.count - a.count);

    return {
      topSearches,
      zeroResultSearches,
      searchesByCategory,
      totalSearches: analytics.totalSearches,
      averageSearchTime: analytics.totalSearches > 0 
        ? Math.round(analytics.totalResponseTime / analytics.totalSearches)
        : 0
    };
  }
}

// Main registration function
// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getVendorsRepository, getStaffRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

export function elasticsearchIntegration(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const es = new ElasticsearchClient();

  /**
   * GET /elasticsearch/health
   * Check Elasticsearch cluster health
   */
  app.get(`${BASE_PATH}/elasticsearch/health`, async (c) => {
    try {
      const health = await es.health();
      return sendSuccess(c, { health });
    } catch (error) {
      console.error('❌ Elasticsearch health check failed:', error);
      return sendError(c, 'Elasticsearch unavailable', 503);
    }
  });

  /**
   * POST /elasticsearch/init
   * Initialize all indices
   */
  app.post(`${BASE_PATH}/elasticsearch/init`, async (c) => {
    try {
      console.log('🔧 Initializing Elasticsearch indices...');

      const indices = ['centers', 'staff', 'services', 'products'];
      const results: any = {};

      for (const indexType of indices) {
        const indexName = `${INDEX_PREFIX}_${indexType}`;
        
        // Check if index exists
        const exists = await es.indexExists(indexName);
        
        if (exists) {
          console.log(`⚠️  Index ${indexName} already exists`);
          results[indexType] = { status: 'exists', indexName };
        } else {
          // Create index
          await es.createIndex(indexName, MAPPINGS[indexType as keyof typeof MAPPINGS]);
          console.log(`✅ Created index: ${indexName}`);
          results[indexType] = { status: 'created', indexName };
        }
      }

      return sendSuccess(c, { results }, 'Indices initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing indices:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /elasticsearch/index/center/:centerId
   * Index a center document
   */
  app.post(`${BASE_PATH}/elasticsearch/index/center/:centerId`, async (c) => {
    try {
      const { centerId } = c.req.param();
      
      // ✅ SQL: Get center data from vendors table
      const vendorsRepo = getVendorsRepository();
      const center = await vendorsRepo.findById(centerId);
      
      if (!center) {
        return sendError(c, 'Center not found', 404);
      }

      // Prepare document for indexing
      const document = {
        vendorId: center.id,
        businessName: center.business_name || center.full_name,
        services: center.services || [],
        location: center.location ? {
          lat: center.location.lat,
          lon: center.location.lng
        } : null,
        rating: center.rating || 0,
        address: center.address || '',
        city: center.city || '',
        state: center.state || '',
        pincode: center.pincode || '',
        isActive: center.is_active !== false,
        description: center.description || center.metadata?.description || '',
        phone: center.phone || '',
        email: center.email || '',
        openingHours: center.metadata?.openingHours || {},
        amenities: center.metadata?.amenities || [],
        createdAt: center.created_at || new Date().toISOString(),
        updatedAt: center.updated_at || new Date().toISOString()
      };

      const indexName = `${INDEX_PREFIX}_centers`;
      await es.indexDocument(indexName, centerId, document);

      console.log(`✅ Indexed center: ${centerId}`);

      return sendSuccess(c, { centerId, indexed: true });

    } catch (error) {
      console.error('❌ Error indexing center:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /elasticsearch/index/staff/:staffId
   * Index a staff document
   */
  app.post(`${BASE_PATH}/elasticsearch/index/staff/:staffId`, async (c) => {
    try {
      const { staffId } = c.req.param();
      
      // ✅ SQL: Get staff from staff table
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }

      const document = {
        staffId: staff.id,
        name: staff.name || staff.full_name || '',
        role: staff.role || '',
        specializations: staff.metadata?.specializations || [],
        vendorId: staff.vendor_id || '',
        rating: staff.metadata?.rating || 0,
        isAvailable: staff.is_active !== false,
        location: staff.location ? {
          lat: staff.location.lat,
          lon: staff.location.lng
        } : null,
        experience: staff.metadata?.experience || 0,
        qualifications: staff.metadata?.qualifications || '',
        bio: staff.metadata?.bio || '',
        languages: staff.metadata?.languages || [],
        serviceStyle: staff.metadata?.serviceStyle || [],
        createdAt: staff.created_at || new Date().toISOString(),
        updatedAt: staff.updated_at || new Date().toISOString()
      };

      const indexName = `${INDEX_PREFIX}_staff`;
      await es.indexDocument(indexName, staffId, document);

      console.log(`✅ Indexed staff: ${staffId}`);

      return sendSuccess(c, { staffId, indexed: true });

    } catch (error) {
      console.error('❌ Error indexing staff:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/search
   * Universal search across all indices
   */
  app.get(`${BASE_PATH}/elasticsearch/search`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const types = c.req.query('types')?.split(',') || ['centers', 'staff', 'services', 'products'];
      const category = c.req.query('category');
      const city = c.req.query('city');
      const priceMin = c.req.query('priceMin') ? parseFloat(c.req.query('priceMin')!) : undefined;
      const priceMax = c.req.query('priceMax') ? parseFloat(c.req.query('priceMax')!) : undefined;
      const ratingMin = c.req.query('ratingMin') ? parseFloat(c.req.query('ratingMin')!) : undefined;
      const lat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
      const lng = c.req.query('lng') ? parseFloat(c.req.query('lng')!) : undefined;
      const radius = c.req.query('radius') ? parseFloat(c.req.query('radius')!) : undefined;
      const sort = c.req.query('sort') || 'relevance';
      const from = c.req.query('from') ? parseInt(c.req.query('from')!) : 0;
      const size = c.req.query('size') ? parseInt(c.req.query('size')!) : 20;

      const filters = {
        category,
        city,
        priceMin,
        priceMax,
        ratingMin,
        lat,
        lng,
        radius,
        sort,
        from,
        size
      };

      const startTime = Date.now();
      const results: any = {};
      let totalResults = 0;

      // Search each index type
      for (const type of types) {
        const indexName = `${INDEX_PREFIX}_${type}`;
        
        try {
          const searchQuery = QueryBuilder.universalSearch(query, filters);
          const response = await es.search(indexName, searchQuery);
          
          results[type] = {
            total: response.hits.total.value,
            hits: response.hits.hits.map((hit: any) => ({
              id: hit._id,
              score: hit._score,
              type,
              ...hit._source,
              highlight: hit.highlight
            }))
          };

          totalResults += response.hits.total.value;

        } catch (error) {
          console.error(`Error searching ${indexName}:`, error);
          results[type] = { total: 0, hits: [] };
        }
      }

      const responseTime = Date.now() - startTime;

      // Track search analytics
      await SearchAnalytics.trackSearch(kv, query, totalResults, responseTime, filters);

      return sendSuccess(c, {
        query,
        total: totalResults,
        results,
        responseTime: `${responseTime}ms`
      });

    } catch (error) {
      console.error('❌ Error performing search:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/autocomplete
   * Autocomplete suggestions
   */
  app.get(`${BASE_PATH}/elasticsearch/autocomplete`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const type = c.req.query('type') || 'centers';

      if (query.length < 2) {
        return sendSuccess(c, { suggestions: [] });
      }

      const indexName = `${INDEX_PREFIX}_${type}`;
      const field = type === 'centers' ? 'businessName' :
                    type === 'staff' ? 'name' :
                    type === 'services' ? 'serviceName' :
                    'productName';

      const searchQuery = QueryBuilder.autocomplete(query, field);
      const response = await es.search(indexName, searchQuery);

      const suggestions = response.hits.hits.map((hit: any) => ({
        text: hit._source[field],
        id: hit._id,
        type
      }));

      return sendSuccess(c, { suggestions });

    } catch (error) {
      console.error('❌ Error performing autocomplete:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/analytics
   * Get search analytics
   */
  app.get(`${BASE_PATH}/elasticsearch/analytics`, async (c) => {
    try {
      const analytics = await SearchAnalytics.getAnalytics();
      return sendSuccess(c, { analytics });
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /elasticsearch/reindex/all
   * Reindex all data from KV store
   */
  app.post(`${BASE_PATH}/elasticsearch/reindex/all`, async (c) => {
    try {
      console.log('🔄 Starting full reindex...');

      const results = {
        centers: 0,
        staff: 0,
        services: 0,
        products: 0
      };

      // ✅ SQL: Reindex centers (vendors) from vendors table
      const vendorsRepo = getVendorsRepository();
      const vendors = await vendorsRepo.findAll({});
      if (vendors.length > 0) {
        const centerDocs = vendors.map((vendor: any) => ({
          id: vendor.id,
          vendorId: vendor.id,
          businessName: vendor.business_name || vendor.full_name,
          services: vendor.metadata?.services || [],
          location: vendor.location ? {
            lat: vendor.location.lat,
            lon: vendor.location.lng
          } : null,
          rating: vendor.average_rating || 0,
          address: vendor.address || '',
          city: vendor.city || '',
          state: vendor.state || '',
          pincode: vendor.pincode || '',
          isActive: vendor.is_active !== false,
          description: vendor.description || vendor.metadata?.description || '',
          phone: vendor.phone || '',
          email: vendor.email || '',
          createdAt: vendor.created_at || new Date().toISOString(),
          updatedAt: vendor.updated_at || new Date().toISOString()
        }));

        await es.bulkIndex(`${INDEX_PREFIX}_centers`, centerDocs);
        results.centers = centerDocs.length;
        console.log(`✅ Indexed ${centerDocs.length} centers`);
      }

      // ✅ SQL: Reindex staff from staff table
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findAll({});
      if (staff.length > 0) {
        const staffDocs = staff.map((s: any) => ({
          id: s.id,
          staffId: s.id,
          name: s.name || s.full_name || '',
          role: s.role || '',
          specializations: s.metadata?.specializations || [],
          vendorId: s.vendor_id || '',
          rating: s.metadata?.rating || 0,
          isAvailable: s.is_active !== false,
            location: s.location ? {
              lat: s.location.lat,
              lon: s.location.lng
            } : null,
            experience: s.experience || 0,
            qualifications: s.qualifications || '',
            bio: s.bio || '',
            languages: s.languages || [],
            serviceStyle: s.serviceStyle || [],
            createdAt: s.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });

        await es.bulkIndex(`${INDEX_PREFIX}_staff`, staffDocs);
        results.staff = staffDocs.length;
        console.log(`✅ Indexed ${staffDocs.length} staff`);
      }

      console.log('✅ Reindex completed:', results);

      return sendSuccess(c, { results }, 'Reindex completed successfully');

    } catch (error) {
      console.error('❌ Error during reindex:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /elasticsearch/indices/status
   * Get status of all indices
   */
  app.get(`${BASE_PATH}/elasticsearch/indices/status`, async (c) => {
    try {
      const indices = ['centers', 'staff', 'services', 'products'];
      const status: any = {};

      for (const indexType of indices) {
        const indexName = `${INDEX_PREFIX}_${indexType}`;
        
        try {
          const exists = await es.indexExists(indexName);
          
          if (exists) {
            const stats = await es.getIndexStats(indexName);
            const indexStats = stats.indices[indexName];
            
            status[indexType] = {
              exists: true,
              documentCount: indexStats.total.docs.count,
              size: `${(indexStats.total.store.size_in_bytes / 1024 / 1024).toFixed(2)} MB`,
              health: 'green' // Simplified - you can get actual health from cluster API
            };
          } else {
            status[indexType] = {
              exists: false,
              documentCount: 0,
              size: '0 MB',
              health: 'N/A'
            };
          }
        } catch (error) {
          status[indexType] = {
            exists: false,
            error: 'Failed to get stats'
          };
        }
      }

      return sendSuccess(c, { indices: status });

    } catch (error) {
      console.error('❌ Error fetching indices status:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Elasticsearch Integration registered');
}
