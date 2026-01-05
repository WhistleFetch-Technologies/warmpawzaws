/**
 * ============================================================================
 * VENDOR DASHBOARD ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-vendor/vendor-dashboard-endpoints.tsx
 *
 * Endpoints:
 * - GET /vendor/dashboard/:vendorId - Get comprehensive dashboard data
 * - GET /vendor/stats/:vendorId - Get statistics
 * - GET /vendor/bookings/:vendorId - Get vendor bookings
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerVendorDashboardEndpoints(app: Hono): void;
//# sourceMappingURL=vendor-dashboard.d.ts.map