/**
 * ============================================================================
 * TIER SYSTEM ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor tier management:
 * - Get vendor tier
 * - Upgrade/downgrade tier
 * - Tier-based commission calculation
 * - Tier eligibility checking
 *
 * Migrated from: supabase/functions/server/tier-system.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerTierSystemEndpoints(app: Hono): void;
//# sourceMappingURL=tier-system.d.ts.map