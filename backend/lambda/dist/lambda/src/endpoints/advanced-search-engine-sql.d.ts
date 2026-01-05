/**
 * ============================================================================
 * ADVANCED SEARCH ENGINE - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Fuzzy search implementation using Fuse.js for:
 * - Vendor search (typo-tolerant, fuzzy matching)
 * - Product search (e-commerce)
 * - Staff search (doctors, trainers, etc.)
 * - Universal search (searches everything)
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `VendorsRepository`, `StaffRepository`, `ProductsRepository`
 * - Uses `vendors`, `staff`, `products`, `services` tables
 *
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerAdvancedSearchEngine(mainApp: Hono): void;
export default registerAdvancedSearchEngine;
//# sourceMappingURL=advanced-search-engine-sql.d.ts.map