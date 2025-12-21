import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🔍 ADVANCED SEARCH API
 * 
 * Phase 7A: Critical Search & Discovery
 * Business Rule 5 Compliance: Advanced Search Features
 * 
 * Features:
 * - Multi-field fuzzy search
 * - Autocomplete & suggestions
 * - Relevance-based ranking
 * - Faceted filtering
 * - Geo-spatial search
 * - Typo tolerance
 * - "Did you mean?" suggestions
 * - Search result highlighting
 */

// Elasticsearch Configuration
const ES_CONFIG = {
  url: Deno.env.get('ELASTICSEARCH_URL') || 'http://localhost:9200',
  apiKey: Deno.env.get('ELASTICSEARCH_API_KEY') || '',
  indexPrefix: Deno.env.get('ELASTICSEARCH_INDEX_PREFIX') || 'warmpawz_',
};

// Elasticsearch Client (simplified)
class SearchClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = ES_CONFIG.url;
    this.headers = {
      'Content-Type': 'application/json',
    };

    if (ES_CONFIG.apiKey) {
      this.headers['Authorization'] = `ApiKey ${ES_CONFIG.apiKey}`;
    }
  }

  private getIndexName(index: string): string {
    return `${ES_CONFIG.indexPrefix}${index}`;
  }

  async search(index: string, query: any) {
    const indexName = this.getIndexName(index);
    const url = `${this.baseUrl}/${indexName}/_search`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.reason || 'Search failed');
    }

    return await response.json();
  }

  async multiSearch(searches: Array<{ index: string; query: any }>) {
    const body = searches.flatMap(({ index, query }) => [
      { index: this.getIndexName(index) },
      query
    ]);

    const url = `${this.baseUrl}/_msearch`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: body.map(item => JSON.stringify(item)).join('\n') + '\n'
    });

    if (!response.ok) {
      throw new Error('Multi-search failed');
    }

    return await response.json();
  }
}

const searchClient = new SearchClient();

// Build Elasticsearch query
function buildSearchQuery(searchParams: {
  query: string;
  filters?: any;
  sort?: any;
  from?: number;
  size?: number;
  highlight?: boolean;
}) {
  const { query, filters = {}, sort, from = 0, size = 20, highlight = true } = searchParams;

  // Build must clauses
  const must: any[] = [];

  // Main search query with fuzzy matching
  if (query && query.trim()) {
    must.push({
      multi_match: {
        query: query,
        fields: [
          'title^3',           // Boost title matches
          'description^2',     // Boost description
          'tags^2',
          'searchableText'
        ],
        type: 'best_fields',
        fuzziness: 'AUTO',    // Auto typo tolerance
        prefix_length: 2,      // Require at least 2 chars to match
        operator: 'or'
      }
    });
  }

  // Build filter clauses
  const filter: any[] = [];

  // Entity type filter
  if (filters.entityTypes && filters.entityTypes.length > 0) {
    filter.push({
      terms: { entityType: filters.entityTypes }
    });
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    filter.push({
      terms: { categories: filters.categories }
    });
  }

  // Price range filter
  if (filters.priceRange) {
    const { min, max } = filters.priceRange;
    const priceFilter: any = { range: { 'pricing.min': {} } };
    
    if (min !== undefined) priceFilter.range['pricing.min'].gte = min;
    if (max !== undefined) priceFilter.range['pricing.max'].lte = max;
    
    filter.push(priceFilter);
  }

  // Rating filter
  if (filters.rating && filters.rating.min) {
    filter.push({
      range: {
        'ratings.average': {
          gte: filters.rating.min
        }
      }
    });
  }

  // Availability filter
  if (filters.availability !== undefined) {
    filter.push({
      term: { 'availability.isAvailable': filters.availability }
    });
  }

  // Location filter (geo distance)
  if (filters.location) {
    const { lat, lng, radius } = filters.location;
    filter.push({
      geo_distance: {
        distance: `${radius || 10}km`,
        location: {
          lat,
          lon: lng
        }
      }
    });
  }

  // Build query
  const esQuery: any = {
    from,
    size,
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter: filter.length > 0 ? filter : undefined
      }
    }
  };

  // Add sorting
  if (sort) {
    esQuery.sort = [sort];
  } else {
    // Default relevance-based sorting with popularity boost
    esQuery.sort = [
      '_score',
      { 'ratings.average': { order: 'desc', missing: 0 } },
      { popularity: { order: 'desc', missing: 0 } }
    ];
  }

  // Add highlighting
  if (highlight) {
    esQuery.highlight = {
      fields: {
        title: {},
        description: {},
        searchableText: {}
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>']
    };
  }

  // Add aggregations for faceted search
  esQuery.aggs = {
    categories: {
      terms: { field: 'categories', size: 20 }
    },
    priceRanges: {
      range: {
        field: 'pricing.min',
        ranges: [
          { to: 500 },
          { from: 500, to: 1000 },
          { from: 1000, to: 2000 },
          { from: 2000 }
        ]
      }
    },
    avgRating: {
      avg: { field: 'ratings.average' }
    },
    entityTypes: {
      terms: { field: 'entityType', size: 10 }
    }
  };

  return esQuery;
}

// Format search results
function formatSearchResults(esResponse: any) {
  const hits = esResponse.hits.hits.map((hit: any) => ({
    id: hit._id,
    score: hit._score,
    ...hit._source,
    highlights: hit.highlight || {}
  }));

  const aggregations = esResponse.aggregations || {};

  return {
    results: hits,
    total: esResponse.hits.total.value,
    took: esResponse.took,
    facets: {
      categories: aggregations.categories?.buckets || [],
      priceRanges: aggregations.priceRanges?.buckets || [],
      avgRating: aggregations.avgRating?.value || 0,
      entityTypes: aggregations.entityTypes?.buckets || []
    }
  };
}

export function advancedSearchAPI(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // ADVANCED SEARCH
  // ========================================

  // Main advanced search endpoint
  app.get(`${BASE_PATH}/search/advanced`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const index = c.req.query('index') || 'vendors';
      const from = parseInt(c.req.query('from') || '0');
      const size = parseInt(c.req.query('size') || '20');

      // Parse filters from query params
      const filters: any = {};

      // Entity types
      const entityTypes = c.req.query('entityTypes');
      if (entityTypes) {
        filters.entityTypes = entityTypes.split(',');
      }

      // Categories
      const categories = c.req.query('categories');
      if (categories) {
        filters.categories = categories.split(',');
      }

      // Price range
      const minPrice = c.req.query('minPrice');
      const maxPrice = c.req.query('maxPrice');
      if (minPrice || maxPrice) {
        filters.priceRange = {
          min: minPrice ? parseFloat(minPrice) : undefined,
          max: maxPrice ? parseFloat(maxPrice) : undefined
        };
      }

      // Rating
      const minRating = c.req.query('minRating');
      if (minRating) {
        filters.rating = { min: parseFloat(minRating) };
      }

      // Availability
      const availability = c.req.query('availability');
      if (availability !== undefined) {
        filters.availability = availability === 'true';
      }

      // Location
      const lat = c.req.query('lat');
      const lng = c.req.query('lng');
      const radius = c.req.query('radius');
      if (lat && lng) {
        filters.location = {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: radius ? parseFloat(radius) : 10
        };
      }

      // Build and execute search
      const esQuery = buildSearchQuery({ query, filters, from, size });
      const esResponse = await searchClient.search(index, esQuery);
      const formattedResults = formatSearchResults(esResponse);

      // Track search analytics
      try {
        const analyticsEvent = {
          eventId: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          query,
          timestamp: new Date().toISOString(),
          results: {
            count: formattedResults.total,
            topResults: formattedResults.results.slice(0, 5).map((r: any) => r.id)
          },
          metadata: {
            source: 'search_bar',
            index
          }
        };

        await kv.set(`search_analytics_${analyticsEvent.eventId}`, analyticsEvent);
      } catch (analyticsError) {
        console.error('Error tracking search analytics:', analyticsError);
      }

      return sendSuccess(c, formattedResults);
    } catch (error) {
      console.error('Advanced search error:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // AUTOCOMPLETE
  // ========================================

  // Autocomplete suggestions
  app.get(`${BASE_PATH}/search/autocomplete`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const index = c.req.query('index') || 'vendors';
      const size = parseInt(c.req.query('size') || '10');

      if (!query || query.length < 2) {
        return sendSuccess(c, { suggestions: [] });
      }

      // Build autocomplete query with prefix matching
      const esQuery = {
        size,
        query: {
          bool: {
            should: [
              {
                match_phrase_prefix: {
                  title: {
                    query,
                    boost: 3
                  }
                }
              },
              {
                match_phrase_prefix: {
                  searchableText: {
                    query
                  }
                }
              }
            ]
          }
        },
        _source: ['title', 'entityType', 'entityId']
      };

      const esResponse = await searchClient.search(index, esQuery);

      const suggestions = esResponse.hits.hits.map((hit: any) => ({
        id: hit._id,
        text: hit._source.title,
        type: hit._source.entityType,
        entityId: hit._source.entityId,
        score: hit._score
      }));

      return sendSuccess(c, { suggestions });
    } catch (error) {
      console.error('Autocomplete error:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // SEARCH SUGGESTIONS
  // ========================================

  // Get search suggestions with "did you mean"
  app.get(`${BASE_PATH}/search/suggest`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const index = c.req.query('index') || 'vendors';

      if (!query || query.length < 3) {
        return sendSuccess(c, { suggestions: [] });
      }

      // Build suggestion query
      const esQuery = {
        suggest: {
          text: query,
          title_suggestion: {
            term: {
              field: 'title.keyword',
              suggest_mode: 'popular',
              min_word_length: 3
            }
          },
          phrase_suggestion: {
            phrase: {
              field: 'searchableText',
              size: 5,
              gram_size: 3,
              direct_generator: [
                {
                  field: 'searchableText',
                  suggest_mode: 'always',
                  min_word_length: 3
                }
              ]
            }
          }
        }
      };

      const esResponse = await searchClient.search(index, esQuery);

      const suggestions = {
        titleSuggestions: esResponse.suggest?.title_suggestion?.[0]?.options || [],
        phraseSuggestions: esResponse.suggest?.phrase_suggestion?.[0]?.options || []
      };

      return sendSuccess(c, suggestions);
    } catch (error) {
      console.error('Suggestion error:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // MULTI-FIELD SEARCH
  // ========================================

  // Search across multiple indices
  app.post(`${BASE_PATH}/search/multi-field`, async (c) => {
    try {
      const { query, indices = ['vendors', 'staff', 'centers', 'services'] } = await c.req.json();

      if (!query) {
        return sendError(c, 'Query is required', 400);
      }

      // Build search queries for each index
      const searches = indices.map((index: string) => ({
        index,
        query: buildSearchQuery({ query, size: 10 })
      }));

      const esResponse = await searchClient.multiSearch(searches);

      // Format results by index
      const resultsByIndex: Record<string, any> = {};
      esResponse.responses.forEach((response: any, idx: number) => {
        const indexName = indices[idx];
        resultsByIndex[indexName] = formatSearchResults(response);
      });

      return sendSuccess(c, {
        query,
        results: resultsByIndex
      });
    } catch (error) {
      console.error('Multi-field search error:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // POPULAR SEARCHES
  // ========================================

  // Get popular/trending searches
  app.get(`${BASE_PATH}/search/popular`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10');

      // Get recent search analytics
      const analyticsData = await kv.getByPrefix('search_analytics_');
      
      if (!analyticsData || analyticsData.length === 0) {
        return sendSuccess(c, { popular: [] });
      }

      // Count query frequencies
      const queryFrequency: Record<string, number> = {};
      
      analyticsData.forEach((item: any) => {
        const event = item.value || item;
        const query = event.query?.toLowerCase().trim();
        
        if (query && query.length > 2) {
          queryFrequency[query] = (queryFrequency[query] || 0) + 1;
        }
      });

      // Sort by frequency
      const popular = Object.entries(queryFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([query, count]) => ({ query, count }));

      return sendSuccess(c, { popular });
    } catch (error) {
      console.error('Popular searches error:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Advanced Search API endpoints registered');
}
