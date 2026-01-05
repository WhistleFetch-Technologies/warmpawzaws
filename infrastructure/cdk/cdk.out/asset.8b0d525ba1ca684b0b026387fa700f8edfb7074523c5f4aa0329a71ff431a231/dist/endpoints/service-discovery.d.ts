/**
 * ============================================================================
 * SERVICE DISCOVERY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Customer-facing service discovery and search:
 * - Multi-category search (Vet, Grooming, Training, Walker, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles with services
 *
 * Migrated from: supabase/functions/make-server-3dd53475/universal-service-discovery.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerServiceDiscoveryEndpoints(app: Hono): void;
//# sourceMappingURL=service-discovery.d.ts.map