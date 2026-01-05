/**
 * ============================================================================
 * PRESCRIPTIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles prescription management:
 * - Create prescriptions (immutable)
 * - Get prescriptions with access control
 * - Download prescriptions
 * - Link prescriptions to bookings
 *
 * Migrated from: supabase/functions/make-server-3dd53475/healthcare-compliance-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerPrescriptionEndpoints(app: Hono): void;
//# sourceMappingURL=prescriptions.d.ts.map