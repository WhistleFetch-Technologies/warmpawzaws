/**
 * ============================================================================
 * EVENT MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles events (adoption drives, fundraisers, pet parties, meetups):
 * - Create/manage events
 * - Event registration
 * - Event discovery
 *
 * Migrated from: supabase/functions/server/event-management-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerEventEndpoints(app: Hono): void;
//# sourceMappingURL=events.d.ts.map