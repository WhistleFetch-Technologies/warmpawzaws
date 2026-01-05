/**
 * ============================================================================
 * STAFF CRUD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Staff management endpoints:
 * - Create staff member
 * - Get all staff for vendor
 * - Get single staff member
 * - Update staff member
 * - Delete staff member (soft delete)
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with repository calls
 * - All data now comes from SQL tables
 *
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerStaffCrudEndpoints(appInstance: Hono): void;
//# sourceMappingURL=staff-crud-endpoints.d.ts.map