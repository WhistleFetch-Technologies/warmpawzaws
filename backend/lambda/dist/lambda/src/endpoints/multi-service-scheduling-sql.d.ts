/**
 * ============================================================================
 * MULTI-SERVICE SCHEDULING SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()` with SQL repository calls
 * - Uses `vendors`, `vendor_services`, `bookings`, `scheduling_policies` tables
 *
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 5
 * ============================================================================
 */
import { Hono } from "hono";
export declare function multiServiceSchedulingEndpoints(app: Hono): void;
//# sourceMappingURL=multi-service-scheduling-sql.d.ts.map