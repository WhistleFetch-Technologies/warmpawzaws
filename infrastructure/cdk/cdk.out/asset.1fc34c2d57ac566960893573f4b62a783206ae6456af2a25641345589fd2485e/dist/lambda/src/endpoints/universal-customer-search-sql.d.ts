/**
 * Universal Customer Search & Listing API - SQL VERSION
 * Works dynamically for ALL vendor roles and service categories
 * Supports filtering by service style (at_center, at_home, tele)
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL repositories
 *
 * ARCHITECTURE DECISION:
 * - at_center services → Returns CENTERS/FACILITIES (customer selects venue)
 * - at_home/tele services → Returns STAFF (customer selects individual provider)
 *
 * Date: 2025-01-27
 * Migration: KV to SQL (27 KV operations → 0)
 */
import { Hono } from 'hono';
/**
 * Register Universal Customer Search Routes
 */
export declare function registerUniversalCustomerSearch(app: Hono): void;
//# sourceMappingURL=universal-customer-search-sql.d.ts.map