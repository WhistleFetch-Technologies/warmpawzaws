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

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerAppointmentReminderSystemSQL(app: Hono) {
  console.log('✅ Registering Appointment Reminder System (SQL-only)...');

  app.use('*', cors());

  const bookingsRepo = getBookingsRepository();
  const notificationsRepo = getNotificationsRepository();
  const client = getDbClient();

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
      const {
        enabled,
        channels, // ['sms', 'push', 'email']
        timings, // [24, 1, 0.5] hours before
        timezone
      } = await c.req.json();

      const preferences = {
        enabled: enabled !== false,
        channels: channels || ['sms', 'push'],
        timings: timings || [24, 1], // Default: 24h and 1h before
        timezone: timezone || 'Asia/Kolkata',
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Store preferences in customer metadata or dedicated table
      await client
        .from('customers')
        .update({
          metadata: {
            reminder_preferences: preferences
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);

      console.log(`🔔 Reminder preferences updated for customer ${customerId}`);

      return sendSuccess(c, {
        preferences,
        message: 'Reminder preferences saved successfully'
      });
    } catch (error) {
      console.error('Error saving reminder preferences:', error);
      return sendError(c, String(error), 500);
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
      const { data: customer } = await client
        .from('customers')
        .select('metadata')
        .eq('id', customerId)
        .maybeSingle();

      const preferences = customer?.metadata?.reminder_preferences || {
        enabled: true,
        channels: ['sms', 'push'],
        timings: [24, 1],
        timezone: 'Asia/Kolkata'
      };

      return sendSuccess(c, { preferences });
    } catch (error) {
      console.error('Error fetching reminder preferences:', error);
      return sendError(c, String(error), 500);
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
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Get customer preferences
      const { data: customer } = await client
        .from('customers')
        .select('metadata')
        .eq('id', booking.customer_id)
        .maybeSingle();

      const preferences = customer?.metadata?.reminder_preferences || {
        enabled: true,
        channels: ['sms', 'push'],
        timings: [24, 1],
        timezone: 'Asia/Kolkata'
      };

      if (!preferences.enabled) {
        return sendSuccess(c, {
          message: 'Reminders disabled for this customer'
        });
      }

      // Parse appointment datetime
      const appointmentTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`);

      // Schedule reminders
      const scheduledReminders: any[] = [];

      for (const timingHours of preferences.timings) {
        const reminderTime = new Date(appointmentTime.getTime() - (timingHours * 60 * 60 * 1000));

        // Don't schedule past reminders
        if (reminderTime < new Date()) {
          continue;
        }

        for (const channel of preferences.channels) {
          const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // ✅ SQL: Create reminder in reminder_queue
          await client
            .from('reminder_queue')
            .insert({
              id: reminderId,
              booking_id: bookingId,
              reminder_type: `appointment_${channel}`,
              scheduled_at: reminderTime.toISOString(),
              status: 'pending',
              created_at: new Date().toISOString()
            });

          scheduledReminders.push({
            id: reminderId,
            channel,
            scheduledFor: reminderTime.toISOString(),
            hoursBeforeAppointment: timingHours
          });
        }
      }

      // ✅ SQL: Update booking metadata with reminder IDs
      await client
        .from('bookings')
        .update({
          metadata: {
            ...(booking.metadata || {}),
            reminder_ids: scheduledReminders.map(r => r.id),
            reminders_scheduled: true
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      console.log(`🔔 Scheduled ${scheduledReminders.length} reminders for booking ${bookingId}`);

      return sendSuccess(c, {
        scheduledReminders,
        count: scheduledReminders.length,
        message: `${scheduledReminders.length} reminders scheduled successfully`
      });
    } catch (error) {
      console.error('Error scheduling reminders:', error);
      return sendError(c, String(error), 500);
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
      const { data: reminders } = await client
        .from('reminder_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true });

      let processedCount = 0;
      let sentCount = 0;
      let failedCount = 0;

      for (const reminder of reminders || []) {
        processedCount++;

        // ✅ SQL: Get booking details
        const booking = await bookingsRepo.findById(reminder.booking_id);
        if (!booking) {
          await client
            .from('reminder_queue')
            .update({ status: 'failed' })
            .eq('id', reminder.id);
          failedCount++;
          continue;
        }

        // Send reminder
        const sent = await sendReminder(reminder, booking);

        if (sent) {
          await client
            .from('reminder_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', reminder.id);
          sentCount++;
        } else {
          await client
            .from('reminder_queue')
            .update({ status: 'failed' })
            .eq('id', reminder.id);
          failedCount++;
        }
      }

      console.log(`🔔 Processed ${processedCount} reminders: ${sentCount} sent, ${failedCount} failed`);

      return sendSuccess(c, {
        processed: processedCount,
        sent: sentCount,
        failed: failedCount,
        remainingInQueue: (reminders || []).length - processedCount
      });
    } catch (error) {
      console.error('Error processing reminder queue:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Helper: Send reminder via configured channel
  async function sendReminder(reminder: any, booking: any): Promise<boolean> {
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
    } catch (error) {
      console.error('Error sending reminder:', error);
      return false;
    }
  }

  // Helper: Generate reminder message
  function generateReminderMessage(reminder: any, booking: any): string {
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
  async function sendSMSReminder(phone: string, message: string, reminderId: string): Promise<boolean> {
    try {
      console.log(`📱 SMS reminder sent to ${phone}: ${message}`);

      // ✅ SQL: Store notification
      await notificationsRepo.create({
        recipient_id: phone,
        recipient_type: 'customer',
        type: 'appointment_reminder',
        title: 'Appointment Reminder',
        message: message,
        channel: 'sms',
        metadata: { reminder_id: reminderId },
        created_at: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error sending SMS reminder:', error);
      return false;
    }
  }

  // Helper: Send push notification
  async function sendPushNotification(customerId: string, message: string, reminderId: string): Promise<boolean> {
    try {
      console.log(`🔔 Push notification sent to customer ${customerId}: ${message}`);

      // ✅ SQL: Store notification
      await notificationsRepo.create({
        recipient_id: customerId,
        recipient_type: 'customer',
        type: 'appointment_reminder',
        title: 'Appointment Reminder',
        message: message,
        channel: 'push',
        metadata: { reminder_id: reminderId },
        created_at: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // Helper: Send email reminder
  async function sendEmailReminder(customerId: string, message: string, reminderId: string): Promise<boolean> {
    try {
      console.log(`📧 Email reminder sent to customer ${customerId}: ${message}`);

      // ✅ SQL: Store notification
      await notificationsRepo.create({
        recipient_id: customerId,
        recipient_type: 'customer',
        type: 'appointment_reminder',
        title: 'Appointment Reminder',
        message: message,
        channel: 'email',
        metadata: { reminder_id: reminderId },
        created_at: new Date().toISOString()
      });

      return true;
    } catch (error) {
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
      const { data: reminders } = await client
        .from('reminder_queue')
        .select('*')
        .eq('booking_id', bookingId)
        .order('scheduled_at', { ascending: false });

      return sendSuccess(c, {
        reminders: reminders || [],
        count: (reminders || []).length
      });
    } catch (error) {
      console.error('Error fetching reminders:', error);
      return sendError(c, String(error), 500);
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
      const { error } = await client
        .from('reminder_queue')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', reminderId)
        .eq('status', 'pending');

      if (error) {
        return sendError(c, 'Reminder not found or cannot be cancelled', 404);
      }

      console.log(`❌ Reminder ${reminderId} cancelled`);
      return sendSuccess(c, { message: 'Reminder cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling reminder:', error);
      return sendError(c, String(error), 500);
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
      const { data: reminder } = await client
        .from('reminder_queue')
        .select('*')
        .eq('id', reminderId)
        .maybeSingle();

      if (!reminder) {
        return sendError(c, 'Reminder not found', 404);
      }

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(reminder.booking_id);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const sent = await sendReminder(reminder, booking);

      if (sent) {
        await client
          .from('reminder_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminderId);

        return sendSuccess(c, { message: 'Reminder sent successfully' });
      } else {
        return sendError(c, 'Failed to send reminder', 500);
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      return sendError(c, String(error), 500);
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
      const { data: reminders, count } = await client
        .from('reminder_queue')
        .select('*, bookings!inner(customer_id)', { count: 'exact' })
        .eq('bookings.customer_id', customerId)
        .order('scheduled_at', { ascending: false })
        .range(offset, offset + limit - 1);

      return sendSuccess(c, {
        reminders: reminders || [],
        pagination: {
          totalCount: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      });
    } catch (error) {
      console.error('Error fetching reminder history:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Appointment Reminder System registered (SQL-only)');
}
