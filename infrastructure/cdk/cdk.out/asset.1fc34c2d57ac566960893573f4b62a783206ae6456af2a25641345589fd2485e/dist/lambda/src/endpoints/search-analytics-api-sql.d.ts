/**
 * ============================================================================
 * SEARCH ANALYTICS API - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Track search queries
 * - Monitor click-through rates
 * - Analyze search trends
 * - Identify failed searches
 * - Conversion tracking
 * - Popular search terms
 * - Search performance metrics
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Search analytics stored in search_analytics table
 *
 * Date: 2025-01-27
 * Migration: Phase 3 - Analytics Entity Migration
 * KV Operations Removed: 10
 * ============================================================================
 */
import { Hono } from "hono";
export declare function searchAnalyticsAPI(app: Hono): void;
//# sourceMappingURL=search-analytics-api-sql.d.ts.map