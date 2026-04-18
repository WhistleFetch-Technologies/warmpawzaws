/**
 * ============================================================================
 * AWS OPENSEARCH CLIENT
 * ============================================================================
 * 
 * Provides search functionality using AWS OpenSearch Service
 * Includes index management, document sync, and query operations
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || '';
const OPENSEARCH_REGION = process.env.AWS_REGION || 'ap-south-1';

// Index names
export const INDEXES = {
  SERVICES: 'warmpawz-services',
  VENDORS: 'warmpawz-vendors',
  STAFF: 'warmpawz-staff',
  PRODUCTS: 'warmpawz-products',
  PROBLEMS: 'warmpawz-problems',
};

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

let client: Client | null = null;

export function getOpenSearchClient(): Client {
  if (!client) {
    if (!OPENSEARCH_ENDPOINT) {
      console.warn('OpenSearch endpoint not configured, using mock client');
      return createMockClient();
    }

    client = new Client({
      ...AwsSigv4Signer({
        region: OPENSEARCH_REGION,
        service: 'es',
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: OPENSEARCH_ENDPOINT,
    });
  }
  return client;
}

// ============================================================================
// INDEX MAPPINGS
// ============================================================================

const SERVICE_MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      /** vendor_services.service_name — primary field for GET /search OpenSearch multi_match */
      service_name: { type: 'text', analyzer: 'standard' },
      name: { type: 'text', analyzer: 'standard' },
      description: { type: 'text', analyzer: 'standard' },
      category: { type: 'keyword' },
      service_style: { type: 'keyword' },
      vendor_id: { type: 'keyword' },
      vendor_name: { type: 'text' },
      specialization: { type: 'text', analyzer: 'standard' },
      city: { type: 'keyword' },
      state: { type: 'keyword' },
      /** Aligns with OpenSearch bool filter in search.ts (cross-index with vendors) */
      status: { type: 'keyword' },
      price: { type: 'float' },
      duration: { type: 'integer' },
      rating: { type: 'float' },
      total_reviews: { type: 'integer' },
      tags: { type: 'keyword' },
      location: { type: 'geo_point' },
      is_active: { type: 'boolean' },
      created_at: { type: 'date' },
      updated_at: { type: 'date' },
    },
  },
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        autocomplete: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'autocomplete_filter'],
        },
      },
      filter: {
        autocomplete_filter: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
        },
      },
    },
  },
};

const VENDOR_MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      business_name: { type: 'text', analyzer: 'standard' },
      owner_name: { type: 'text' },
      role_id: { type: 'keyword' },
      service_styles: { type: 'keyword' },
      rating: { type: 'float' },
      total_reviews: { type: 'integer' },
      address: { type: 'text' },
      city: { type: 'keyword' },
      state: { type: 'keyword' },
      location: { type: 'geo_point' },
      service_radius_km: { type: 'float' },
      is_active: { type: 'boolean' },
      specializations: { type: 'keyword' },
      created_at: { type: 'date' },
    },
  },
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
  },
};

const STAFF_MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: { type: 'text', analyzer: 'standard' },
      vendor_id: { type: 'keyword' },
      role: { type: 'keyword' },
      specializations: { type: 'keyword' },
      rating: { type: 'float' },
      total_reviews: { type: 'integer' },
      location: { type: 'geo_point' },
      service_radius_km: { type: 'float' },
      is_available: { type: 'boolean' },
      is_active: { type: 'boolean' },
    },
  },
};

const PRODUCT_MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: { type: 'text', analyzer: 'standard' },
      description: { type: 'text' },
      category: { type: 'keyword' },
      vendor_id: { type: 'keyword' },
      price: { type: 'float' },
      stock_quantity: { type: 'integer' },
      rating: { type: 'float' },
      tags: { type: 'keyword' },
      is_active: { type: 'boolean' },
    },
  },
};

const PROBLEM_MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      symptom: { type: 'text', analyzer: 'standard' },
      category: { type: 'keyword' },
      severity: { type: 'keyword' },
      related_services: { type: 'keyword' },
      related_specializations: { type: 'keyword' },
      icon: { type: 'keyword' },
    },
  },
};

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

export async function createIndex(indexName: string): Promise<void> {
  const client = getOpenSearchClient();
  
  const mappings: Record<string, any> = {
    [INDEXES.SERVICES]: SERVICE_MAPPING,
    [INDEXES.VENDORS]: VENDOR_MAPPING,
    [INDEXES.STAFF]: STAFF_MAPPING,
    [INDEXES.PRODUCTS]: PRODUCT_MAPPING,
    [INDEXES.PROBLEMS]: PROBLEM_MAPPING,
  };

  try {
    const exists = await client.indices.exists({ index: indexName });
    
    if (!exists.body) {
      await client.indices.create({
        index: indexName,
        body: mappings[indexName] || {},
      });
      console.log(`Index created: ${indexName}`);
    }
  } catch (error) {
    console.error(`Error creating index ${indexName}:`, error);
    throw error;
  }
}

export async function deleteIndex(indexName: string): Promise<void> {
  const client = getOpenSearchClient();
  
  try {
    await client.indices.delete({ index: indexName });
    console.log(`Index deleted: ${indexName}`);
  } catch (error) {
    console.error(`Error deleting index ${indexName}:`, error);
  }
}

export async function initializeAllIndexes(): Promise<void> {
  for (const indexName of Object.values(INDEXES)) {
    await createIndex(indexName);
  }
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export async function indexDocument(
  indexName: string,
  id: string,
  document: Record<string, any>
): Promise<void> {
  const client = getOpenSearchClient();
  
  try {
    await client.index({
      index: indexName,
      id,
      body: document,
      refresh: true,
    });
    console.log(`Document indexed: ${indexName}/${id}`);
  } catch (error) {
    console.error(`Error indexing document ${indexName}/${id}:`, error);
    throw error;
  }
}

export async function updateDocument(
  indexName: string,
  id: string,
  document: Record<string, any>
): Promise<void> {
  const client = getOpenSearchClient();
  
  try {
    await client.update({
      index: indexName,
      id,
      body: { doc: document },
      refresh: true,
    });
    console.log(`Document updated: ${indexName}/${id}`);
  } catch (error) {
    console.error(`Error updating document ${indexName}/${id}:`, error);
    throw error;
  }
}

export async function deleteDocument(indexName: string, id: string): Promise<void> {
  const client = getOpenSearchClient();
  
  try {
    await client.delete({
      index: indexName,
      id,
      refresh: true,
    });
    console.log(`Document deleted: ${indexName}/${id}`);
  } catch (error) {
    console.error(`Error deleting document ${indexName}/${id}:`, error);
  }
}

export async function bulkIndex(
  indexName: string,
  documents: Array<{ id: string; document: Record<string, any> }>
): Promise<void> {
  const client = getOpenSearchClient();
  
  const body = documents.flatMap(({ id, document }) => [
    { index: { _index: indexName, _id: id } },
    document,
  ]);
  
  try {
    const response = await client.bulk({ body, refresh: true });
    
    if (response.body.errors) {
      const errorItems = response.body.items.filter((item: any) => item.index?.error);
      console.error('Bulk index errors:', errorItems);
    } else {
      console.log(`Bulk indexed ${documents.length} documents to ${indexName}`);
    }
  } catch (error) {
    console.error(`Error bulk indexing to ${indexName}:`, error);
    throw error;
  }
}

// ============================================================================
// SEARCH OPERATIONS
// ============================================================================

export interface SearchOptions {
  query: string;
  filters?: Record<string, any>;
  location?: { lat: number; lon: number };
  distance?: string;
  from?: number;
  size?: number;
  sort?: Array<Record<string, any>>;
}

export interface SearchResult<T> {
  hits: Array<{
    id: string;
    score: number;
    document: T;
    distance_km?: number;
  }>;
  total: number;
  took: number;
}

export async function searchServices(options: SearchOptions): Promise<SearchResult<any>> {
  const client = getOpenSearchClient();
  
  const must: any[] = [];
  const filter: any[] = [{ term: { is_active: true } }];

  // Text search
  if (options.query) {
    must.push({
      multi_match: {
        query: options.query,
        fields: ['name^3', 'description^2', 'tags', 'vendor_name'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  // Category filter
  if (options.filters?.category) {
    filter.push({ term: { category: options.filters.category } });
  }

  // Service style filter
  if (options.filters?.service_style) {
    filter.push({ term: { service_style: options.filters.service_style } });
  }

  // Geo distance filter
  if (options.location && options.distance) {
    filter.push({
      geo_distance: {
        distance: options.distance,
        location: {
          lat: options.location.lat,
          lon: options.location.lon,
        },
      },
    });
  }

  const body: any = {
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    },
    from: options.from || 0,
    size: options.size || 20,
  };

  // Sort by distance if location provided
  if (options.location) {
    body.sort = [
      {
        _geo_distance: {
          location: {
            lat: options.location.lat,
            lon: options.location.lon,
          },
          order: 'asc',
          unit: 'km',
        },
      },
      { rating: { order: 'desc' } },
    ];
  } else {
    body.sort = options.sort || [{ rating: { order: 'desc' } }];
  }

  try {
    const response = await client.search({
      index: INDEXES.SERVICES,
      body,
    });

    return {
      hits: response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        document: hit._source,
        distance_km: hit.sort?.[0],
      })),
      total: response.body.hits.total.value,
      took: response.body.took,
    };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

export async function searchVendors(options: SearchOptions): Promise<SearchResult<any>> {
  const client = getOpenSearchClient();
  
  const must: any[] = [];
  const filter: any[] = [{ term: { is_active: true } }];

  if (options.query) {
    must.push({
      multi_match: {
        query: options.query,
        fields: ['business_name^3', 'owner_name^2', 'specializations', 'address'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  if (options.filters?.role_id) {
    filter.push({ term: { role_id: options.filters.role_id } });
  }

  if (options.filters?.service_style) {
    filter.push({ term: { service_styles: options.filters.service_style } });
  }

  if (options.filters?.city) {
    filter.push({ term: { city: options.filters.city } });
  }

  // Geo distance for home/mobile services
  if (options.location && options.distance) {
    filter.push({
      geo_distance: {
        distance: options.distance,
        location: {
          lat: options.location.lat,
          lon: options.location.lon,
        },
      },
    });
  }

  const body: any = {
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    },
    from: options.from || 0,
    size: options.size || 20,
  };

  if (options.location) {
    body.sort = [
      {
        _geo_distance: {
          location: {
            lat: options.location.lat,
            lon: options.location.lon,
          },
          order: 'asc',
          unit: 'km',
        },
      },
      { rating: { order: 'desc' } },
    ];
  }

  try {
    const response = await client.search({
      index: INDEXES.VENDORS,
      body,
    });

    return {
      hits: response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        document: hit._source,
        distance_km: hit.sort?.[0],
      })),
      total: response.body.hits.total.value,
      took: response.body.took,
    };
  } catch (error) {
    console.error('Vendor search error:', error);
    throw error;
  }
}

export async function searchStaff(options: SearchOptions & { vendor_id?: string }): Promise<SearchResult<any>> {
  const client = getOpenSearchClient();
  
  const must: any[] = [];
  const filter: any[] = [
    { term: { is_active: true } },
    { term: { is_available: true } },
  ];

  if (options.query) {
    must.push({
      multi_match: {
        query: options.query,
        fields: ['name^3', 'specializations'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  if (options.filters?.vendor_id) {
    filter.push({ term: { vendor_id: options.filters.vendor_id } });
  }

  if (options.filters?.specialization) {
    filter.push({ term: { specializations: options.filters.specialization } });
  }

  // For home services, filter by service radius
  if (options.location) {
    filter.push({
      bool: {
        should: [
          {
            geo_distance: {
              distance: '50km', // Max radius, actual filtering by service_radius_km
              location: {
                lat: options.location.lat,
                lon: options.location.lon,
              },
            },
          },
        ],
      },
    });
  }

  const body: any = {
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    },
    from: options.from || 0,
    size: options.size || 20,
    sort: options.location
      ? [
          {
            _geo_distance: {
              location: {
                lat: options.location.lat,
                lon: options.location.lon,
              },
              order: 'asc',
              unit: 'km',
            },
          },
          { rating: { order: 'desc' } },
        ]
      : [{ rating: { order: 'desc' } }],
  };

  try {
    const response = await client.search({
      index: INDEXES.STAFF,
      body,
    });

    return {
      hits: response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        document: hit._source,
        distance_km: hit.sort?.[0],
      })),
      total: response.body.hits.total.value,
      took: response.body.took,
    };
  } catch (error) {
    console.error('Staff search error:', error);
    throw error;
  }
}

export async function autocomplete(
  query: string,
  indexName: string = INDEXES.SERVICES,
  size: number = 10
): Promise<string[]> {
  const client = getOpenSearchClient();
  
  try {
    const response = await client.search({
      index: indexName,
      body: {
        query: {
          bool: {
            should: [
              {
                match_phrase_prefix: {
                  name: {
                    query,
                    max_expansions: 10,
                  },
                },
              },
              {
                match: {
                  tags: query,
                },
              },
            ],
          },
        },
        _source: ['name'],
        size,
      },
    });

    return response.body.hits.hits.map((hit: any) => hit._source.name);
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

// ============================================================================
// MOCK CLIENT (for development without OpenSearch)
// ============================================================================

function createMockClient(): Client {
  return {
    indices: {
      exists: async () => ({ body: true }),
      create: async () => ({}),
      delete: async () => ({}),
    },
    index: async () => ({}),
    update: async () => ({}),
    delete: async () => ({}),
    bulk: async () => ({ body: { errors: false, items: [] } }),
    search: async () => ({
      body: {
        hits: { hits: [], total: { value: 0 } },
        took: 0,
      },
    }),
  } as unknown as Client;
}

