/**
 * ============================================================================
 * ENHANCED SMS NOTIFICATION SERVICE - LAMBDA VERSION
 * ============================================================================
 *
 * Complete SMS notification system for booking lifecycle events:
 * - Event-triggered SMS
 * - Template management
 * - Delivery tracking
 * - Multi-provider support (AWS SNS)
 * - Retry logic
 *
 * Migrated from: supabase/functions/server/sms-notification-service-enhanced.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function triggerBookingNotification(event: string, data: any): Promise<void>;
export declare function registerSmsNotificationEndpoints(app: Hono): void;
//# sourceMappingURL=sms-notifications.d.ts.map