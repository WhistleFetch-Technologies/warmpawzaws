/**
 * ============================================================================
 * ORDER MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles order lifecycle management:
 * - Update order status
 * - Order tracking
 * - Order cancellation
 *
 * Migrated from: supabase/functions/make-server-3dd53475/order-lifecycle-complete-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerOrderManagementEndpoints(app: Hono): void;
//# sourceMappingURL=order-management.d.ts.map