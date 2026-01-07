/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 *
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 *
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - GET /customer/by-phone - Get customer by phone
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 *
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerCustomerEndpointsEnhanced(app: Hono): void;
//# sourceMappingURL=customer-enhanced.d.ts.map