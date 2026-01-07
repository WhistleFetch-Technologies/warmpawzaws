/**
 * ============================================================================
 * SUBSCRIPTION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor subscription plans:
 * - Create subscription plans
 * - Subscribe to plans
 * - Cancel subscriptions
 * - Process renewals
 *
 * Migrated from: supabase/functions/server/subscription-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerSubscriptionEndpoints(app: Hono): void;
//# sourceMappingURL=subscriptions.d.ts.map