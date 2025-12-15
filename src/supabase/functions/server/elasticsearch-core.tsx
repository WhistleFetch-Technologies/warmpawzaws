import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🔍 ELASTICSEARCH CORE INTEGRATION
 * 
 * Phase 7A: Critical Search & Discovery
 * Business Rule 5 Compliance: True Elasticsearch Integration
 * 
 * Features:
 * - Real Elasticsearch cluster integration
 * - Document indexing (single & bulk)
 * - Index management
 * - Health monitoring
 * - Auto-reindexing
 * - Fuzzy search configuration
 * - Relevance scoring
 * 
 * Environment Variables Required:
 * - ELASTICSEARCH_URL: Your ES cluster URL
 * - ELASTICSEARCH_API_KEY: API key for authentication
 * - ELASTICSEARCH_INDEX_PREFIX: Prefix for indices (default: warmpawz_)
 */

// Elasticsearch Configuration
const ES_CONFIG = {
  url: Deno.env.get('ELASTICSEARCH_URL') || 'http://localhost:9200',
  apiKey: Deno.env.get('ELASTICSEARCH_API_KEY') || '',
  indexPrefix: Deno.env.get('ELASTICSEARCH_INDEX_PREFIX') || 'warmpawz_',
  
  indices: {
    vendors: 'vendors',
    staff: 'staff',
    centers: 'centers',
    services: 'services',
    products: 'products'
  }
};

// Elasticsearch Client Helper
class ElasticsearchClient {
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

  // Get full index name with prefix
  private getIndexName(index: string): string {
    return `${ES_CONFIG.indexPrefix}${index}`;
  }

  // Generic ES request
  private async request(method: string, path: string, body?: any) {
    const url = `${this.baseUrl}${path}`;
    
    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.reason || 'Elasticsearch request failed');
      }

      return data;
    } catch (error) {
      console.error('Elasticsearch request error:', error);
      throw error;
    }
  }

  // Check cluster health
  async health() {
    return await this.request('GET', '/_cluster/health');
  }

  // Create index with mappings
  async createIndex(index: string, mappings: any) {
    const indexName = this.getIndexName(index);
    
    try {
      return await this.request('PUT', `/${indexName}`, {
        mappings,
        settings: {
          analysis: {
            analyzer: {
              warmpawz_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding', 'warmpawz_synonym']
              }
            },
            filter: {
              warmpawz_synonym: {
                type: 'synonym',
                synonyms: [
                  'vet, veterinarian, veterinary',
                  'dog, puppy, canine',
                  'cat, kitten, feline',
                  'grooming, groomer, groom',
                  'training, trainer, train'
                ]
              }
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error creating index ${indexName}:`, error);
      throw error;
    }
  }

  // Index a document
  async indexDocument(index: string, id: string, document: any) {
    const indexName = this.getIndexName(index);
    return await this.request('PUT', `/${indexName}/_doc/${id}`, document);
  }

  // Bulk index documents
  async bulkIndex(index: string, documents: Array<{ id: string; doc: any }>) {
    const indexName = this.getIndexName(index);
    
    // Build bulk request body
    const bulkBody = documents.flatMap(({ id, doc }) => [
      { index: { _index: indexName, _id: id } },
      doc
    ]);

    return await this.request('POST', '/_bulk', bulkBody.map(item => JSON.stringify(item)).join('\n') + '\n');
  }

  // Delete document
  async deleteDocument(index: string, id: string) {
    const indexName = this.getIndexName(index);
    return await this.request('DELETE', `/${indexName}/_doc/${id}`);
  }

  // Search documents
  async search(index: string, query: any) {
    const indexName = this.getIndexName(index);
    return await this.request('POST', `/${indexName}/_search`, query);
  }

  // Get index stats
  async getIndexStats(index: string) {
    const indexName = this.getIndexName(index);
    return await this.request('GET', `/${indexName}/_stats`);
  }

  // Delete index
  async deleteIndex(index: string) {
    const indexName = this.getIndexName(index);
    return await this.request('DELETE', `/${indexName}`);
  }

  // Check if index exists
  async indexExists(index: string): Promise<boolean> {
    const indexName = this.getIndexName(index);
    try {
      const response = await fetch(`${this.baseUrl}/${indexName}`, {
        method: 'HEAD',
        headers: this.headers
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Index Mappings
const VENDOR_MAPPING = {
  properties: {
    entityType: { type: 'keyword' },
    entityId: { type: 'keyword' },
    
    // Searchable text fields
    title: {
      type: 'text',
      analyzer: 'warmpawz_analyzer',
      fields: {
        keyword: { type: 'keyword' },
        ngram: {
          type: 'text',
          analyzer: 'standard',
          search_analyzer: 'standard'
        }
      }
    },
    description: {
      type: 'text',
      analyzer: 'warmpawz_analyzer'
    },
    tags: { type: 'keyword' },
    categories: { type: 'keyword' },
    
    // Location
    location: {
      type: 'geo_point'
    },
    city: { type: 'keyword' },
    area: { type: 'keyword' },
    
    // Pricing
    pricing: {
      properties: {
        min: { type: 'float' },
        max: { type: 'float' },
        currency: { type: 'keyword' }
      }
    },
    
    // Ratings
    ratings: {
      properties: {
        average: { type: 'float' },
        count: { type: 'integer' }
      }
    },
    
    // Availability
    availability: {
      properties: {
        isAvailable: { type: 'boolean' },
        nextAvailable: { type: 'date' }
      }
    },
    
    // Relevance scoring
    popularity: { type: 'rank_feature' },
    bookingsCount: { type: 'integer' },
    
    // Combined searchable text
    searchableText: {
      type: 'text',
      analyzer: 'warmpawz_analyzer'
    },
    
    // Timestamps
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    lastIndexedAt: { type: 'date' }
  }
};

// Initialize Elasticsearch client
const esClient = new ElasticsearchClient();

export function elasticsearchCoreEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // HEALTH & STATUS
  // ========================================

  // Check Elasticsearch cluster health
  app.get(`${BASE_PATH}/search/elasticsearch/health`, async (c) => {
    try {
      const health = await esClient.health();
      
      return sendSuccess(c, {
        cluster: health,
        config: {
          url: ES_CONFIG.url,
          hasApiKey: !!ES_CONFIG.apiKey,
          indexPrefix: ES_CONFIG.indexPrefix
        }
      });
    } catch (error) {
      console.error('Elasticsearch health check failed:', error);
      return sendError(c, 'Elasticsearch cluster unavailable', 503, { error: String(error) });
    }
  });

  // ========================================
  // INDEX MANAGEMENT
  // ========================================

  // Create index with mappings
  app.post(`${BASE_PATH}/search/elasticsearch/create-index`, async (c) => {
    try {
      const { index, mappings } = await c.req.json();

      if (!index) {
        return sendError(c, 'Index name required', 400);
      }

      // Check if index already exists
      const exists = await esClient.indexExists(index);
      if (exists) {
        return sendError(c, 'Index already exists', 409);
      }

      // Use custom mappings or default vendor mapping
      const indexMappings = mappings || VENDOR_MAPPING;

      const result = await esClient.createIndex(index, indexMappings);

      console.log(`✅ Created Elasticsearch index: ${ES_CONFIG.indexPrefix}${index}`);

      return sendSuccess(c, {
        index: `${ES_CONFIG.indexPrefix}${index}`,
        acknowledged: result.acknowledged
      }, 'Index created successfully');
    } catch (error) {
      console.error('Error creating index:', error);
      return sendError(c, error, 500);
    }
  });

  // Initialize all indices
  app.post(`${BASE_PATH}/search/elasticsearch/initialize`, async (c) => {
    try {
      const results = [];

      for (const [name, indexName] of Object.entries(ES_CONFIG.indices)) {
        const exists = await esClient.indexExists(indexName);
        
        if (!exists) {
          await esClient.createIndex(indexName, VENDOR_MAPPING);
          results.push({ index: indexName, action: 'created' });
          console.log(`✅ Created index: ${ES_CONFIG.indexPrefix}${indexName}`);
        } else {
          results.push({ index: indexName, action: 'already_exists' });
        }
      }

      return sendSuccess(c, { results }, 'Elasticsearch indices initialized');
    } catch (error) {
      console.error('Error initializing indices:', error);
      return sendError(c, error, 500);
    }
  });

  // Get index stats
  app.get(`${BASE_PATH}/search/elasticsearch/index-stats/:index`, async (c) => {
    try {
      const index = c.req.param('index');
      const stats = await esClient.getIndexStats(index);

      return sendSuccess(c, { stats });
    } catch (error) {
      console.error('Error getting index stats:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete index
  app.delete(`${BASE_PATH}/search/elasticsearch/index/:index`, async (c) => {
    try {
      const index = c.req.param('index');
      
      const result = await esClient.deleteIndex(index);

      console.log(`🗑️ Deleted Elasticsearch index: ${ES_CONFIG.indexPrefix}${index}`);

      return sendSuccess(c, {}, 'Index deleted successfully');
    } catch (error) {
      console.error('Error deleting index:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // DOCUMENT INDEXING
  // ========================================

  // Index single document
  app.post(`${BASE_PATH}/search/elasticsearch/index`, async (c) => {
    try {
      const { index, id, document } = await c.req.json();

      if (!index || !id || !document) {
        return sendError(c, 'index, id, and document are required', 400);
      }

      // Add indexing timestamp
      const docWithTimestamp = {
        ...document,
        lastIndexedAt: new Date().toISOString()
      };

      const result = await esClient.indexDocument(index, id, docWithTimestamp);

      console.log(`📝 Indexed document ${id} in ${index}`);

      return sendSuccess(c, {
        indexed: true,
        result: result.result
      }, 'Document indexed successfully');
    } catch (error) {
      console.error('Error indexing document:', error);
      return sendError(c, error, 500);
    }
  });

  // Bulk index documents
  app.post(`${BASE_PATH}/search/elasticsearch/bulk-index`, async (c) => {
    try {
      const { index, documents } = await c.req.json();

      if (!index || !documents || !Array.isArray(documents)) {
        return sendError(c, 'index and documents array are required', 400);
      }

      // Add indexing timestamp to all documents
      const documentsWithTimestamp = documents.map(({ id, doc }) => ({
        id,
        doc: {
          ...doc,
          lastIndexedAt: new Date().toISOString()
        }
      }));

      const result = await esClient.bulkIndex(index, documentsWithTimestamp);

      console.log(`📦 Bulk indexed ${documents.length} documents in ${index}`);

      return sendSuccess(c, {
        indexed: documents.length,
        errors: result.errors,
        took: result.took
      }, 'Documents bulk indexed successfully');
    } catch (error) {
      console.error('Error bulk indexing:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete document from index
  app.delete(`${BASE_PATH}/search/elasticsearch/index/:index/document/:id`, async (c) => {
    try {
      const index = c.req.param('index');
      const id = c.req.param('id');

      const result = await esClient.deleteDocument(index, id);

      console.log(`🗑️ Deleted document ${id} from ${index}`);

      return sendSuccess(c, {}, 'Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Elasticsearch Core endpoints registered');
}
