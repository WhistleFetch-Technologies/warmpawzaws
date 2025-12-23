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
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, insertQuery, selectQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

export class SearchHistoryRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateSearchHistoryInput): Promise<SearchHistory> {
    const results = await insertQuery<SearchHistory>("search_history", {
      customer_id: input.customer_id,
      search_query: input.search_query,
      results_count: input.results_count || 0,
      clicked_result_id: input.clicked_result_id || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create search history");
    }
    
    return results[0];
  }

  async findByCustomer(customerId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<SearchHistory[]> {
    return selectQuery<SearchHistory>("search_history", { customer_id: customerId }, {
      limit: options?.limit || 20,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }
}

let repositoryInstance: SearchHistoryRepository | null = null;

export function getSearchHistoryRepository(): SearchHistoryRepository {
  if (!repositoryInstance) {
    repositoryInstance = new SearchHistoryRepository();
  }
  return repositoryInstance;
}

