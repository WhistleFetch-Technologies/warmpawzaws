/**
 * APPOINTMENT REMINDER SYSTEM (SQL-ONLY VERSION)
 *
 * Features:
 * - Automatic SMS/push reminders before appointments
 * - Configurable reminder times (24h, 1h, 30min before)
 * - Reminder preferences management
 * - Reminder delivery tracking
 * - Manual reminder triggering
 * - Reminder history
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - All data now comes from SQL tables (reminder_queue, customer_preferences, notifications)
 *
 * Date: 2025-01-27
 * Migration: Batch 9 - 500 KV Operations Migration
 * Status: ✅ P2 IMPLEMENTATION
 */
import { Hono } from 'hono';
export declare function registerAppointmentReminderSystemSQL(app: Hono): void;
//# sourceMappingURL=appointment-reminder-system-sql.d.ts.map