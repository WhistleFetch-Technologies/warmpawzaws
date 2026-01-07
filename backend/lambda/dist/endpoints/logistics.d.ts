/**
 * ============================================================================
 * LOGISTICS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles logistics integration (Shiprocket, Delhivery, etc.):
 * - Create shipment
 * - Track shipment
 * - Generate AWB
 * - Calculate shipping charges
 *
 * Migrated from: supabase/functions/server/shiprocket-integration.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerLogisticsEndpoints(app: Hono): void;
//# sourceMappingURL=logistics.d.ts.map