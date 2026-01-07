/**
 * ============================================================================
 * SEARCH HISTORY REPOSITORY
 * ============================================================================
 *
 * Repository for search history data access.
 * Replaces: customer:{customerId}:recent_searches KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2025-01-28
 * ============================================================================
 */
import type { Pool } from "../db";
export interface SearchHistory {
    id: string;
    customer_id: string;
    search_query: string;
    results_count: number;
    clicked_result_id?: string | null;
    created_at: string;
}
export interface CreateSearchHistoryInput {
    customer_id: string;
    search_query: string;
    results_count?: number;
    clicked_result_id?: string;
}
export declare class SearchHistoryRepository {
    private pool;
    constructor(pool?: Pool);
    create(input: CreateSearchHistoryInput): Promise<SearchHistory>;
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<SearchHistory[]>;
}
export declare function getSearchHistoryRepository(): SearchHistoryRepository;
//# sourceMappingURL=search-history.d.ts.map