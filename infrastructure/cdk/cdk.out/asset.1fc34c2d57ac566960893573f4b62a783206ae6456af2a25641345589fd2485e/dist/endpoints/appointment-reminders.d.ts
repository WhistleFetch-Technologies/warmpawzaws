/**
 * ============================================================================
 * APPOINTMENT REMINDER SYSTEM ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Features:
 * - Automatic SMS/push reminders before appointments
 * - Configurable reminder times (24h, 1h, 30min before)
 * - Reminder preferences management
 * - Reminder delivery tracking
 * - Manual reminder triggering
 *
 * Migrated from: supabase/functions/server/appointment-reminder-system.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerAppointmentReminderEndpoints(app: Hono): void;
//# sourceMappingURL=appointment-reminders.d.ts.map