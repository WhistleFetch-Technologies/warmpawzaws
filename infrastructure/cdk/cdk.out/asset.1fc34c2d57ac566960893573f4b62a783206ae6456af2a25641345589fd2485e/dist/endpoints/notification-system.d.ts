/**
 * ============================================================================
 * NOTIFICATION SYSTEM ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Comprehensive notification infrastructure for all platform events:
 * - Email notifications
 * - SMS notifications
 * - In-app notifications
 * - Push notifications (future)
 *
 * Migrated from: supabase/functions/server/notification-system.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export type NotificationType = 'vendor_application_submitted' | 'vendor_application_approved' | 'vendor_application_rejected' | 'booking_created' | 'booking_confirmed' | 'booking_cancelled' | 'booking_completed' | 'admin_new_vendor_application' | 'system_maintenance' | 'system_announcement';
export type NotificationCategory = 'vendor_onboarding' | 'bookings' | 'admin_alerts' | 'system';
export declare function registerNotificationSystemEndpoints(app: Hono): void;
//# sourceMappingURL=notification-system.d.ts.map