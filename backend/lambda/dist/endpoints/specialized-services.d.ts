/**
 * ============================================================================
 * SPECIALIZED SERVICES ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles special configuration requirements for different vendor types:
 * - Ambulance: Vehicle fleet, drivers
 * - Diagnostics: Test catalog, equipment
 * - Pharmacy: Medicine inventory
 * - Nutritionist: Meal plans
 * - Cafe: Tables, PAX capacity
 * - Breeder/Adoption: Puppy/Pet profiles
 * - Pet Resort/Boarding: Room configuration, pricing
 *
 * Migrated from: supabase/functions/make-server-3dd53475/specialized-vendor-config-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerSpecializedServicesEndpoints(app: Hono): void;
//# sourceMappingURL=specialized-services.d.ts.map