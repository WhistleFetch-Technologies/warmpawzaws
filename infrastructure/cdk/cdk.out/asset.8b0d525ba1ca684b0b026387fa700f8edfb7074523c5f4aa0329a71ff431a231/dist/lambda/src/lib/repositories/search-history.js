"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchHistoryRepository = void 0;
exports.getSearchHistoryRepository = getSearchHistoryRepository;
const db_1 = require("../db");
class SearchHistoryRepository {
    pool = null;
    constructor(pool) {
        if (pool) {
            this.pool = pool;
        }
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("search_history", {
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
    async findByCustomer(customerId, options) {
        return (0, db_1.selectQuery)("search_history", { customer_id: customerId }, {
            limit: options?.limit || 20,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
}
exports.SearchHistoryRepository = SearchHistoryRepository;
let repositoryInstance = null;
function getSearchHistoryRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new SearchHistoryRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=search-history.js.map