/**
 * ============================================================================
 * NOTIFICATIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles notifications:
 * - Get notifications for user
 * - Mark as read
 * - Create notifications
 * - Send SMS/push notifications via SNS
 *
 * Migrated from: supabase/functions/server/notification-system.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerNotificationEndpoints(app: Hono): void;
//# sourceMappingURL=notifications.d.ts.map