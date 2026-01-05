"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAppointmentReminderSystemSQL = registerAppointmentReminderSystemSQL;
const cors_1 = require("hono/cors");
const response_utils_1 = require("./response-utils");
const bookings_1 = require("../lib/repositories/bookings");
const notifications_1 = require("../lib/repositories/notifications");
const db_1 = require("../lib/db");
const BASE_PATH = '/make-server-3dd53475';
function registerAppointmentReminderSystemSQL(app) {
    console.log('✅ Registering Appointment Reminder System (SQL-only)...');
    app.use('*', (0, cors_1.cors)());
    const bookingsRepo = (0, bookings_1.getBookingsRepository)();
    const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
    // ==========================================================================
    // REMINDER PREFERENCES
    // ==========================================================================
    /**
     * POST /customer/:customerId/reminder-preferences
     * Set reminder preferences
     */
    app.post(`${BASE_PATH}/customer/:customerId/reminder-preferences`, async (c) => {
        try {
            const customerId = c.req.param('customerId');
            const { enabled, channels, // ['sms', 'push', 'email']
            timings, // [24, 1, 0.5] hours before
            timezone } = await c.req.json();
            const preferences = {
                enabled: enabled !== false,
                channels: channels || ['sms', 'push'],
                timings: timings || [24, 1], // Default: 24h and 1h before
                timezone: timezone || 'Asia/Kolkata',
                updatedAt: new Date().toISOString()
            };
            // ✅ SQL: Store preferences in customer metadata or dedicated table
            const pool = await (0, db_1.getDbClient)();
            const customerResult = await pool.query('SELECT metadata FROM customers WHERE id = $1', [customerId]);
            const existingMetadata = customerResult.rows[0]?.metadata || {};
            await pool.query('UPDATE customers SET metadata = $1, updated_at = $2 WHERE id = $3', [
                JSON.stringify({
                    ...existingMetadata,
                    reminder_preferences: preferences
                }),
                new Date().toISOString(),
                customerId
            ]);
            console.log(`🔔 Reminder preferences updated for customer ${customerId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                preferences,
                message: 'Reminder preferences saved successfully'
            });
        }
        catch (error) {
            console.error('Error saving reminder preferences:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /customer/:customerId/reminder-preferences
     * Get reminder preferences
     */
    app.get(`${BASE_PATH}/customer/:customerId/reminder-preferences`, async (c) => {
        try {
            const customerId = c.req.param('customerId');
            // ✅ SQL: Get preferences from customer metadata
            const pool = await (0, db_1.getDbClient)();
            const customerResult = await pool.query('SELECT metadata FROM customers WHERE id = $1 LIMIT 1', [customerId]);
            const customer = customerResult.rows[0] ? { metadata: customerResult.rows[0].metadata } : null;
            const preferences = customer?.metadata?.reminder_preferences || {
                enabled: true,
                channels: ['sms', 'push'],
                timings: [24, 1],
                timezone: 'Asia/Kolkata'
            };
            return (0, response_utils_1.sendSuccess)(c, { preferences });
        }
        catch (error) {
            console.error('Error fetching reminder preferences:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    // ==========================================================================
    // SCHEDULE REMINDERS
    // ==========================================================================
    /**
     * POST /bookings/:bookingId/schedule-reminders
     * Schedule reminders for a booking (auto-called on booking creation)
     */
    app.post(`${BASE_PATH}/bookings/:bookingId/schedule-reminders`, async (c) => {
        try {
            const bookingId = c.req.param('bookingId');
            // ✅ SQL: Get booking
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // ✅ SQL: Get customer preferences
            const pool = await (0, db_1.getDbClient)();
            const customerResult = await pool.query('SELECT metadata FROM customers WHERE id = $1 LIMIT 1', [booking.customer_id]);
            const customer = customerResult.rows[0] ? { metadata: customerResult.rows[0].metadata } : null;
            const preferences = customer?.metadata?.reminder_preferences || {
                enabled: true,
                channels: ['sms', 'push'],
                timings: [24, 1],
                timezone: 'Asia/Kolkata'
            };
            if (!preferences.enabled) {
                return (0, response_utils_1.sendSuccess)(c, {
                    message: 'Reminders disabled for this customer'
                });
            }
            // Parse appointment datetime
            const appointmentTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`);
            // Schedule reminders
            const scheduledReminders = [];
            for (const timingHours of preferences.timings) {
                const reminderTime = new Date(appointmentTime.getTime() - (timingHours * 60 * 60 * 1000));
                // Don't schedule past reminders
                if (reminderTime < new Date()) {
                    continue;
                }
                for (const channel of preferences.channels) {
                    const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    // ✅ SQL: Create reminder in reminder_queue
                    const pool = await (0, db_1.getDbClient)();
                    await pool.query('INSERT INTO reminder_queue (id, booking_id, reminder_type, scheduled_at, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [reminderId, bookingId, `appointment_${channel}`, reminderTime.toISOString(), 'pending', new Date().toISOString()]);
                    scheduledReminders.push({
                        id: reminderId,
                        channel,
                        scheduledFor: reminderTime.toISOString(),
                        hoursBeforeAppointment: timingHours
                    });
                }
            }
            // ✅ SQL: Update booking metadata with reminder IDs
            const bookingPool = await (0, db_1.getDbClient)();
            const existingMetadata = booking.metadata || {};
            await bookingPool.query('UPDATE bookings SET metadata = $1, updated_at = $2 WHERE id = $3', [
                JSON.stringify({
                    ...existingMetadata,
                    reminder_ids: scheduledReminders.map(r => r.id),
                    reminders_scheduled: true
                }),
                new Date().toISOString(),
                bookingId
            ]);
            console.log(`🔔 Scheduled ${scheduledReminders.length} reminders for booking ${bookingId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                scheduledReminders,
                count: scheduledReminders.length,
                message: `${scheduledReminders.length} reminders scheduled successfully`
            });
        }
        catch (error) {
            console.error('Error scheduling reminders:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    // ==========================================================================
    // PROCESS REMINDERS (Background Job)
    // ==========================================================================
    /**
     * POST /reminders/process-queue
     * Process pending reminders (called by background job every 5 minutes)
     */
    app.post(`${BASE_PATH}/reminders/process-queue`, async (c) => {
        try {
            const now = new Date();
            // ✅ SQL: Get pending reminders due for sending
            const pool = await (0, db_1.getDbClient)();
            const remindersResult = await pool.query('SELECT * FROM reminder_queue WHERE status = $1 AND scheduled_at <= $2 ORDER BY scheduled_at ASC', ['pending', now.toISOString()]);
            const reminders = remindersResult.rows || [];
            let processedCount = 0;
            let sentCount = 0;
            let failedCount = 0;
            for (const reminder of reminders || []) {
                processedCount++;
                // ✅ SQL: Get booking details
                const booking = await bookingsRepo.findById(reminder.booking_id);
                if (!booking) {
                    const updatePool = await (0, db_1.getDbClient)();
                    await updatePool.query('UPDATE reminder_queue SET status = $1 WHERE id = $2', ['failed', reminder.id]);
                    failedCount++;
                    continue;
                }
                // Send reminder
                const sent = await sendReminder(reminder, booking);
                if (sent) {
                    const updatePool = await (0, db_1.getDbClient)();
                    await updatePool.query('UPDATE reminder_queue SET status = $1, sent_at = $2 WHERE id = $3', ['sent', new Date().toISOString(), reminder.id]);
                    sentCount++;
                }
                else {
                    const updatePool = await (0, db_1.getDbClient)();
                    await updatePool.query('UPDATE reminder_queue SET status = $1 WHERE id = $2', ['failed', reminder.id]);
                    failedCount++;
                }
            }
            console.log(`🔔 Processed ${processedCount} reminders: ${sentCount} sent, ${failedCount} failed`);
            return (0, response_utils_1.sendSuccess)(c, {
                processed: processedCount,
                sent: sentCount,
                failed: failedCount,
                remainingInQueue: (reminders || []).length - processedCount
            });
        }
        catch (error) {
            console.error('Error processing reminder queue:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    // Helper: Send reminder via configured channel
    async function sendReminder(reminder, booking) {
        try {
            const message = generateReminderMessage(reminder, booking);
            const channel = reminder.reminder_type.split('_')[1] || 'sms';
            switch (channel) {
                case 'sms':
                    return await sendSMSReminder(booking.customer_phone, message, reminder.id);
                case 'push':
                    return await sendPushNotification(booking.customer_id, message, reminder.id);
                case 'email':
                    return await sendEmailReminder(booking.customer_id, message, reminder.id);
                default:
                    console.error(`Unknown channel: ${channel}`);
                    return false;
            }
        }
        catch (error) {
            console.error('Error sending reminder:', error);
            return false;
        }
    }
    // Helper: Generate reminder message
    function generateReminderMessage(reminder, booking) {
        const scheduledAt = new Date(reminder.scheduled_at);
        const appointmentTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`);
        const hoursBefore = Math.round((appointmentTime.getTime() - scheduledAt.getTime()) / (1000 * 60 * 60));
        const hoursText = hoursBefore === 24
            ? 'tomorrow'
            : hoursBefore === 1
                ? 'in 1 hour'
                : `in ${hoursBefore} hours`;
        return `🐾 Reminder: Your ${booking.service_name} appointment with ${booking.vendor_name} is ${hoursText} on ${booking.booking_date} at ${booking.booking_time}. Pet: ${booking.pet_name}. Reply CANCEL to cancel.`;
    }
    // Helper: Send SMS reminder
    async function sendSMSReminder(phone, message, reminderId) {
        try {
            console.log(`📱 SMS reminder sent to ${phone}: ${message}`);
            // ✅ SQL: Store notification
            await notificationsRepo.create({
                recipient_id: phone,
                recipient_type: 'customer',
                notification_type: 'appointment_reminder',
                title: 'Appointment Reminder',
                message: message,
                channels: { sms: true },
                data: { reminder_id: reminderId }
            });
            return true;
        }
        catch (error) {
            console.error('Error sending SMS reminder:', error);
            return false;
        }
    }
    // Helper: Send push notification
    async function sendPushNotification(customerId, message, reminderId) {
        try {
            console.log(`🔔 Push notification sent to customer ${customerId}: ${message}`);
            // ✅ SQL: Store notification
            await notificationsRepo.create({
                recipient_id: customerId,
                recipient_type: 'customer',
                notification_type: 'appointment_reminder',
                title: 'Appointment Reminder',
                message: message,
                channels: { push: true },
                data: { reminder_id: reminderId }
            });
            return true;
        }
        catch (error) {
            console.error('Error sending push notification:', error);
            return false;
        }
    }
    // Helper: Send email reminder
    async function sendEmailReminder(customerId, message, reminderId) {
        try {
            console.log(`📧 Email reminder sent to customer ${customerId}: ${message}`);
            // ✅ SQL: Store notification
            await notificationsRepo.create({
                recipient_id: customerId,
                recipient_type: 'customer',
                notification_type: 'appointment_reminder',
                title: 'Appointment Reminder',
                message: message,
                channels: { email: true },
                data: { reminder_id: reminderId }
            });
            return true;
        }
        catch (error) {
            console.error('Error sending email reminder:', error);
            return false;
        }
    }
    // ==========================================================================
    // REMINDER MANAGEMENT
    // ==========================================================================
    /**
     * GET /bookings/:bookingId/reminders
     * Get all reminders for a booking
     */
    app.get(`${BASE_PATH}/bookings/:bookingId/reminders`, async (c) => {
        try {
            const bookingId = c.req.param('bookingId');
            // ✅ SQL: Get reminders for booking
            const pool = await (0, db_1.getDbClient)();
            const remindersResult = await pool.query('SELECT * FROM reminder_queue WHERE booking_id = $1 ORDER BY scheduled_at DESC', [bookingId]);
            const reminders = remindersResult.rows || [];
            return (0, response_utils_1.sendSuccess)(c, {
                reminders: reminders || [],
                count: (reminders || []).length
            });
        }
        catch (error) {
            console.error('Error fetching reminders:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * DELETE /reminders/:reminderId/cancel
     * Cancel a scheduled reminder
     */
    app.delete(`${BASE_PATH}/reminders/:reminderId/cancel`, async (c) => {
        try {
            const reminderId = c.req.param('reminderId');
            // ✅ SQL: Update reminder status
            const pool = await (0, db_1.getDbClient)();
            const updateResult = await pool.query('UPDATE reminder_queue SET status = $1, updated_at = $2 WHERE id = $3 AND status = $4', ['cancelled', new Date().toISOString(), reminderId, 'pending']);
            if (updateResult.rowCount === 0) {
                return (0, response_utils_1.sendError)(c, 'Reminder not found or cannot be cancelled', 404);
            }
            console.log(`❌ Reminder ${reminderId} cancelled`);
            return (0, response_utils_1.sendSuccess)(c, { message: 'Reminder cancelled successfully' });
        }
        catch (error) {
            console.error('Error cancelling reminder:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /reminders/:reminderId/send-now
     * Send reminder immediately (manual trigger)
     */
    app.post(`${BASE_PATH}/reminders/:reminderId/send-now`, async (c) => {
        try {
            const reminderId = c.req.param('reminderId');
            // ✅ SQL: Get reminder
            const pool = await (0, db_1.getDbClient)();
            const reminderResult = await pool.query('SELECT * FROM reminder_queue WHERE id = $1 LIMIT 1', [reminderId]);
            const reminder = reminderResult.rows[0] || null;
            if (!reminder) {
                return (0, response_utils_1.sendError)(c, 'Reminder not found', 404);
            }
            // ✅ SQL: Get booking
            const booking = await bookingsRepo.findById(reminder.booking_id);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            const sent = await sendReminder(reminder, booking);
            if (sent) {
                const updatePool = await (0, db_1.getDbClient)();
                await updatePool.query('UPDATE reminder_queue SET status = $1, sent_at = $2 WHERE id = $3', ['sent', new Date().toISOString(), reminderId]);
                return (0, response_utils_1.sendSuccess)(c, { message: 'Reminder sent successfully' });
            }
            else {
                return (0, response_utils_1.sendError)(c, 'Failed to send reminder', 500);
            }
        }
        catch (error) {
            console.error('Error sending reminder:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /customer/:customerId/reminder-history
     * Get reminder history for customer
     */
    app.get(`${BASE_PATH}/customer/:customerId/reminder-history`, async (c) => {
        try {
            const customerId = c.req.param('customerId');
            const limit = parseInt(c.req.query('limit') || '50');
            const offset = parseInt(c.req.query('offset') || '0');
            // ✅ SQL: Get reminders for customer's bookings
            const pool = await (0, db_1.getDbClient)();
            const remindersResult = await pool.query(`SELECT rq.* FROM reminder_queue rq
         INNER JOIN bookings b ON rq.booking_id = b.id
         WHERE b.customer_id = $1
         ORDER BY rq.scheduled_at DESC
         LIMIT $2 OFFSET $3`, [customerId, limit, offset]);
            const reminders = remindersResult.rows || [];
            // Get total count
            const countResult = await pool.query(`SELECT COUNT(*) as total FROM reminder_queue rq
         INNER JOIN bookings b ON rq.booking_id = b.id
         WHERE b.customer_id = $1`, [customerId]);
            const count = parseInt(countResult.rows[0]?.total || '0', 10);
            return (0, response_utils_1.sendSuccess)(c, {
                reminders: reminders || [],
                pagination: {
                    totalCount: count || 0,
                    limit,
                    offset,
                    hasMore: (count || 0) > offset + limit
                }
            });
        }
        catch (error) {
            console.error('Error fetching reminder history:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    console.log('✅ Appointment Reminder System registered (SQL-only)');
}
//# sourceMappingURL=appointment-reminder-system-sql.js.map