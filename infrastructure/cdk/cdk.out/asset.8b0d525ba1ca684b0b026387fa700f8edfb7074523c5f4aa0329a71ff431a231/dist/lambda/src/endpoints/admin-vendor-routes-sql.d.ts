/**
 * ============================================================================
 * ADMIN VENDOR ROUTES - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Admin endpoints for vendor management:
 * - Vendor statistics
 * - Application approval/rejection
 * - Platform settings
 * - Deactivation requests
 * - Reverification
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All vendor operations use VendorsRepository
 * - Notifications use NotificationsRepository
 * - Platform settings use platform_settings table
 *
 * Date: 2025-01-27
 * Migration: Phase 3, Task 3.5
 * ============================================================================
 */
import { Hono } from "hono";
export declare function registerAdminVendorRoutes(app: Hono): void;
//# sourceMappingURL=admin-vendor-routes-sql.d.ts.map