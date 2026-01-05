/**
 * Expiry Management Endpoints (SQL-ONLY VERSION)
 * Handles product expiry tracking, alerts, and batch management for pharmacies and stores
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()`, `kv.del()` with SQL repository calls
 * - All data now comes from SQL tables (product_batches, expiry_alerts, disposal_records)
 *
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 */
import { Hono } from 'hono';
export declare function registerExpiryManagementEndpointsSQL(app: Hono): void;
//# sourceMappingURL=expiry-management-endpoints-sql.d.ts.map