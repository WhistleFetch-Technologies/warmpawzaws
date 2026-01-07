/**
 * ============================================================================
 * CCTV ACCESS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - CCTV camera management (CRUD)
 * - Camera status updates
 * - Customer access tokens
 * - Access logging
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()`, `kv.del()` with SQL queries
 * - Uses `platform_settings` table (JSONB for CCTV config)
 * - Stores cameras in platform_settings.cctv_cameras JSONB array
 * - Stores access logs in platform_settings.cctv_access_logs JSONB array
 * - Stores tokens in platform_settings.cctv_tokens JSONB array
 *
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function cctvAccessEndpointsSQL(mainApp: Hono): void;
export default cctvAccessEndpointsSQL;
//# sourceMappingURL=cctv-access-endpoints-sql.d.ts.map