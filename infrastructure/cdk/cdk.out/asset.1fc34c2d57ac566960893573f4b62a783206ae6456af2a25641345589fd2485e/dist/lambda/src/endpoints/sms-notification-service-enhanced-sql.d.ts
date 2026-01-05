/**
 * ============================================================================
 * ENHANCED SMS NOTIFICATION SERVICE - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Complete SMS notification system for all booking lifecycle events
 *
 * Features:
 * - Event-triggered SMS
 * - Template management
 * - Delivery tracking
 * - Multi-provider support (Twilio/AWS SNS)
 * - Retry logic
 * - Analytics
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - SMS logs stored in `notification_logs` table
 * - Platform settings stored in `platform_settings` table
 * - Analytics aggregated from `notification_logs` table
 *
 * Date: 2025-01-27
 * Migration: Phase 2 - KV to SQL Migration
 * ============================================================================
 */
import { Hono } from "hono";
export declare function triggerBookingNotification(event: string, data: any): Promise<void>;
export declare function smsNotificationServiceEnhanced(app: Hono): void;
//# sourceMappingURL=sms-notification-service-enhanced-sql.d.ts.map