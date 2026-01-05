/**
 * ============================================================================
 * CUSTOMER ROUTES - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Complete customer-facing API endpoints:
 * - OTP & Authentication
 * - Customer Profile Management
 * - Pet Management
 * - Service Discovery
 * - Vendor Discovery
 * - Booking Management
 * - Rating & Review
 * - Notifications
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with repository calls
 * - All data now comes from SQL tables
 *
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */
import { Hono } from "hono";
export declare function registerCustomerRoutes(app: Hono): void;
//# sourceMappingURL=customer-routes.d.ts.map