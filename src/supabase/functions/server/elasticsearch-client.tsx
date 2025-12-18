/**
 * Elasticsearch Client for Warmpawz
 * Provides scalable search infrastructure
 */

import { Hono } from 'npm:hono';

// Elasticsearch configuration from environment
const ELASTICSEARCH_URL = Deno.env.get('ELASTICSEARCH_URL') || 'http://localhost:9200';
const ELASTICSEARCH_USERNAME = Deno.env.get('ELASTICSEARCH_USERNAME') || '';
const ELASTICSEARCH_PASSWORD = Deno.env.get('ELASTICSEARCH_PASSWORD') || '';

// Base64 encode credentials for API auth
const ELASTICSEARCH_AUTH = ELASTICSEARCH_USERNAME && ELASTICSEARCH_PASSWORD
  ? btoa(`${ELASTICSEARCH_USERNAME}:${ELASTICSEARCH_PASSWORD}`)
  : null;

/**
 * Elasticsearch Client Class
 */
export class ElasticsearchClient {
  private baseUrl: string;
  private authHeader: string | null;

  constructor() {
    this.baseUrl = ELASTICSEARCH_URL;
    this.authHeader = ELASTICSEARCH_AUTH
      ? `Basic ${ELASTICSEARCH_AUTH}`
      : null;
  }

  /**
   * Make request to Elasticsearch
   */
  private async request(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Elasticsearch error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ [ELASTICSEARCH] Request failed:`, error);
      throw error;
    }
  }

  /**
   * Check if Elasticsearch is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/_cluster/health');
      return true;
    } catch (error) {
      console.warn('⚠️ [ELASTICSEARCH] Not available, falling back to KV store');
      return false;
    }
  }

  /**
   * Create index if not exists
   */
  async createIndex(indexName: string, mapping?: any): Promise<void> {
    try {
      const exists = await this.request('HEAD', `/${indexName}`);
      if (exists) {
        console.log(`✅ [ELASTICSEARCH] Index ${indexName} already exists`);
        return;
      }
    } catch (error) {
      // Index doesn't exist, create it
    }

    const body = mapping || {
      mappings: {
        properties: {
          name: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          tags: { type: 'keyword' },
          location: { type: 'geo_point' },
          createdAt: { type: 'date' },
        },
      },
    };

    await this.request('PUT', `/${indexName}`, body);
    console.log(`✅ [ELASTICSEARCH] Index ${indexName} created`);
  }

  /**
   * Index a document
   */
  async index(indexName: string, id: string, document: any): Promise<void> {
    try {
      await this.request('PUT', `/${indexName}/_doc/${id}`, document);
      console.log(`✅ [ELASTICSEARCH] Indexed document ${id} in ${indexName}`);
    } catch (error) {
      console.error(`❌ [ELASTICSEARCH] Failed to index ${id}:`, error);
      throw error;
    }
  }

  /**
   * Bulk index documents
   */
  async bulkIndex(indexName: string, documents: Array<{ id: string; doc: any }>): Promise<void> {
    const body = documents
      .map(({ id, doc }) => [
        JSON.stringify({ index: { _index: indexName, _id: id } }),
        JSON.stringify(doc),
      ])
      .flat()
      .join('\n') + '\n';

    try {
      await fetch(`${this.baseUrl}/_bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          ...(this.authHeader ? { Authorization: this.authHeader } : {}),
        },
        body,
      });
      console.log(`✅ [ELASTICSEARCH] Bulk indexed ${documents.length} documents`);
    } catch (error) {
      console.error(`❌ [ELASTICSEARCH] Bulk index failed:`, error);
      throw error;
    }
  }

  /**
   * Search documents
   */
  async search(
    indexName: string,
    query: string,
    filters?: {
      location?: { lat: number; lng: number; radius?: string };
      category?: string;
      priceRange?: { min?: number; max?: number };
      sortBy?: 'relevance' | 'distance' | 'rating' | 'price';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ hits: any[]; total: number }> {
    const searchBody: any = {
      query: {
        bool: {
          must: [],
          filter: [],
        },
      },
      size: filters?.limit || 20,
      from: filters?.offset || 0,
    };

    // Text search
    if (query) {
      searchBody.query.bool.must.push({
        multi_match: {
          query,
          fields: ['name^3', 'description^2', 'tags'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    } else {
      searchBody.query.bool.must.push({ match_all: {} });
    }

    // Location filter
    if (filters?.location) {
      searchBody.query.bool.filter.push({
        geo_distance: {
          distance: filters.location.radius || '10km',
          location: {
            lat: filters.location.lat,
            lon: filters.location.lng,
          },
        },
      });
    }

    // Category filter
    if (filters?.category) {
      searchBody.query.bool.filter.push({
        term: { category: filters.category },
      });
    }

    // Price range filter
    if (filters?.priceRange) {
      searchBody.query.bool.filter.push({
        range: {
          price: {
            ...(filters.priceRange.min !== undefined ? { gte: filters.priceRange.min } : {}),
            ...(filters.priceRange.max !== undefined ? { lte: filters.priceRange.max } : {}),
          },
        },
      });
    }

    // Sorting
    if (filters?.sortBy === 'distance' && filters?.location) {
      searchBody.sort = [
        {
          _geo_distance: {
            location: {
              lat: filters.location.lat,
              lon: filters.location.lng,
            },
            order: 'asc',
            unit: 'km',
          },
        },
      ];
    } else if (filters?.sortBy === 'rating') {
      searchBody.sort = [{ rating: { order: 'desc' } }];
    } else if (filters?.sortBy === 'price') {
      searchBody.sort = [{ price: { order: 'asc' } }];
    }

    try {
      const result = await this.request('POST', `/${indexName}/_search`, searchBody);
      return {
        hits: result.hits.hits.map((hit: any) => ({
          ...hit._source,
          _id: hit._id,
          _score: hit._score,
        })),
        total: result.hits.total.value || result.hits.total,
      };
    } catch (error) {
      console.error(`❌ [ELASTICSEARCH] Search failed:`, error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async delete(indexName: string, id: string): Promise<void> {
    try {
      await this.request('DELETE', `/${indexName}/_doc/${id}`);
      console.log(`✅ [ELASTICSEARCH] Deleted document ${id} from ${indexName}`);
    } catch (error) {
      console.error(`❌ [ELASTICSEARCH] Failed to delete ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update document
   */
  async update(indexName: string, id: string, doc: any): Promise<void> {
    try {
      await this.request('POST', `/${indexName}/_doc/${id}`, doc);
      console.log(`✅ [ELASTICSEARCH] Updated document ${id} in ${indexName}`);
    } catch (error) {
      console.error(`❌ [ELASTICSEARCH] Failed to update ${id}:`, error);
      throw error;
    }
  }
}

// Singleton instance
let esClient: ElasticsearchClient | null = null;

export function getElasticsearchClient(): ElasticsearchClient {
  if (!esClient) {
    esClient = new ElasticsearchClient();
  }
  return esClient;
}

/**
 * Initialize Elasticsearch indices
 */
export async function initializeElasticsearchIndices(): Promise<void> {
  const client = getElasticsearchClient();
  
  // Check if Elasticsearch is available
  const isAvailable = await client.healthCheck();
  if (!isAvailable) {
    console.warn('⚠️ [ELASTICSEARCH] Not available, skipping index initialization');
    return;
  }

  // Create indices with mappings
  await client.createIndex('vendors', {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        businessName: { type: 'text', analyzer: 'standard' },
        description: { type: 'text', analyzer: 'standard' },
        roleId: { type: 'keyword' },
        role: { type: 'keyword' },
        location: { type: 'geo_point' },
        rating: { type: 'float' },
        price: { type: 'float' },
        tags: { type: 'keyword' },
        services: { type: 'keyword' },
        isActive: { type: 'boolean' },
        createdAt: { type: 'date' },
      },
    },
  });

  await client.createIndex('staff', {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        fullName: { type: 'text', analyzer: 'standard' },
        specialization: { type: 'text', analyzer: 'standard' },
        vendorId: { type: 'keyword' },
        roleId: { type: 'keyword' },
        location: { type: 'geo_point' },
        consultationFee: { type: 'float' },
        rating: { type: 'float' },
        experience: { type: 'integer' },
        isActive: { type: 'boolean' },
        createdAt: { type: 'date' },
      },
    },
  });

  await client.createIndex('services', {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'text', analyzer: 'standard' },
        description: { type: 'text', analyzer: 'standard' },
        category: { type: 'keyword' },
        vendorId: { type: 'keyword' },
        price: { type: 'float' },
        duration: { type: 'integer' },
        tags: { type: 'keyword' },
        isActive: { type: 'boolean' },
        createdAt: { type: 'date' },
      },
    },
  });

  console.log('✅ [ELASTICSEARCH] All indices initialized');
}

