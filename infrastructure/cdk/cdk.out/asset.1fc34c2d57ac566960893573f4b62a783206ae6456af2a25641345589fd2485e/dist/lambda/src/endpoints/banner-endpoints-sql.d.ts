/**
 * ============================================================================
 * BANNER ENDPOINTS (SQL-ONLY)
 * ============================================================================
 *
 * Complete banner management with SQL persistence.
 * Replaces: content-management-endpoints.tsx KV-based banner operations
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ S3 integration for media files
 * ✅ Full lifecycle: create, read, update, delete, analytics
 *
 * Date: 2025-01-22
 * ============================================================================
 */
import { Hono } from "hono";
export declare function registerBannerEndpointsSQL(app: Hono): void;
//# sourceMappingURL=banner-endpoints-sql.d.ts.map