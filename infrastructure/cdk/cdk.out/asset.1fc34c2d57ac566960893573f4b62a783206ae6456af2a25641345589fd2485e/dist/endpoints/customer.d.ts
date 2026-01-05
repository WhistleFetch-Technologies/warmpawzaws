/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-customer/customer-routes.tsx
 *
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerCustomerEndpoints(app: Hono): void;
//# sourceMappingURL=customer.d.ts.map