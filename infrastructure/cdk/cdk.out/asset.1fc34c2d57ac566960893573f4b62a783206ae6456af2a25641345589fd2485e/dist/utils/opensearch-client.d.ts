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
export declare const INDEXES: {
    SERVICES: string;
    VENDORS: string;
    STAFF: string;
    PRODUCTS: string;
    PROBLEMS: string;
};
export declare function getOpenSearchClient(): Client;
export declare function createIndex(indexName: string): Promise<void>;
export declare function deleteIndex(indexName: string): Promise<void>;
export declare function initializeAllIndexes(): Promise<void>;
export declare function indexDocument(indexName: string, id: string, document: Record<string, any>): Promise<void>;
export declare function updateDocument(indexName: string, id: string, document: Record<string, any>): Promise<void>;
export declare function deleteDocument(indexName: string, id: string): Promise<void>;
export declare function bulkIndex(indexName: string, documents: Array<{
    id: string;
    document: Record<string, any>;
}>): Promise<void>;
export interface SearchOptions {
    query: string;
    filters?: Record<string, any>;
    location?: {
        lat: number;
        lon: number;
    };
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
export declare function searchServices(options: SearchOptions): Promise<SearchResult<any>>;
export declare function searchVendors(options: SearchOptions): Promise<SearchResult<any>>;
export declare function searchStaff(options: SearchOptions & {
    vendor_id?: string;
}): Promise<SearchResult<any>>;
export declare function autocomplete(query: string, indexName?: string, size?: number): Promise<string[]>;
//# sourceMappingURL=opensearch-client.d.ts.map