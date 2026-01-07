/**
 * ============================================================================
 * TIME WINDOW SUBSCRIPTION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles time window subscription scheduling:
 * - Create time window subscriptions
 * - Manage recurring schedules
 * - Morning/Afternoon/Evening time slots
 *
 * Migrated from: supabase/functions/server/time-window-subscription.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerTimeWindowSubscriptionEndpoints(app: Hono): void;
//# sourceMappingURL=time-window-subscription.d.ts.map