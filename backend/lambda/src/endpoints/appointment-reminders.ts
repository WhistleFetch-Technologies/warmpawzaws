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
import { select, insert, update, query, upsert } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerAppointmentReminderEndpoints(app: Hono) {
  /**
   * POST /customer/:customerId/reminder-preferences
   * Set reminder preferences
   */
  app.post("/customer/:customerId/reminder-preferences", async (c) => {
    try {
      const { customerId } = c.req.param();
      const {
        enabled,
        channels, // ['sms', 'push', 'email']
        timings, // [24, 1, 0.5] hours before
        timezone,
      } = await c.req.json();

      const preferences = {
        enabled: enabled !== false,
        channels: channels || ['sms', 'push'],
        timings: timings || [24, 1], // Default: 24h and 1h before
        timezone: timezone || 'Asia/Kolkata',
        updatedAt: new Date().toISOString(),
      };

      // Store in customer preferences
      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const existingPreferences = (customers[0].preferences as any) || {};
      await update('customers',
        { id: customerId },
        {
          preferences: {
            ...existingPreferences,
            reminderPreferences: preferences,
          },
        }
      );

      return c.json({
        success: true,
        preferences,
        message: 'Reminder preferences saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving reminder preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/reminder-preferences
   * Get reminder preferences
   */
  app.get("/customer/:customerId/reminder-preferences", async (c) => {
    try {
      const { customerId } = c.req.param();

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const preferences = (customers[0].preferences as any)?.reminderPreferences || {
        enabled: true,
        channels: ['sms', 'push'],
        timings: [24, 1],
        timezone: 'Asia/Kolkata',
      };

      return c.json({
        success: true,
        preferences,
      });
    } catch (error: any) {
      console.error('Error fetching reminder preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /bookings/:bookingId/schedule-reminders
   * Schedule reminders for a booking
   */
  app.post("/bookings/:bookingId/schedule-reminders", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get customer preferences
      const customers = await select('customers', { id: booking.customer_id });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const preferences = (customers[0].preferences as any)?.reminderPreferences || {
        enabled: true,
        channels: ['sms', 'push'],
        timings: [24, 1],
        timezone: 'Asia/Kolkata',
      };

      if (!preferences.enabled) {
        return c.json({
          success: true,
          message: 'Reminders disabled for this customer',
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
          const reminder = await insert('appointment_reminders', {
            booking_id: bookingId,
            customer_id: booking.customer_id,
            channel: channel, // 'sms', 'push', 'email'
            scheduled_for: reminderTime.toISOString(),
            appointment_time: appointmentTime.toISOString(),
            hours_before_appointment: timingHours,
            status: 'scheduled',
          });

          scheduledReminders.push(reminder[0]);
        }
      }

      return c.json({
        success: true,
        reminders: scheduledReminders,
        message: `${scheduledReminders.length} reminders scheduled`,
      });
    } catch (error: any) {
      console.error('Error scheduling reminders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /bookings/:bookingId/send-reminder
   * Manually trigger a reminder
   */
  app.post("/bookings/:bookingId/send-reminder", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { channel = 'sms' } = await c.req.json();

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get customer
      const customers = await select('customers', { id: booking.customer_id });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Get service
      const services = await select('services', { id: booking.service_id });
      const serviceName = services.length > 0 ? services[0].name : 'Service';

      // Send reminder
      if (channel === 'sms' && customer.phone) {
        const appointmentTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`);
        const message = `Reminder: Your ${serviceName} appointment is scheduled for ${appointmentTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`;

        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          PhoneNumber: customer.phone,
          Message: message,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        }));

        // Log reminder
        await insert('appointment_reminders', {
          booking_id: bookingId,
          customer_id: booking.customer_id,
          channel: 'sms',
          scheduled_for: new Date().toISOString(),
          appointment_time: appointmentTime.toISOString(),
          hours_before_appointment: 0, // Manual trigger
          status: 'sent',
          sent_at: new Date().toISOString(),
        }).catch(() => {});
      }

      return c.json({
        success: true,
        message: 'Reminder sent successfully',
      });
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/reminders
   * Get reminder history for customer
   */
  app.get("/customer/:customerId/reminders", async (c) => {
    try {
      const { customerId } = c.req.param();

      const reminders = await query(
        `SELECT * FROM appointment_reminders 
         WHERE customer_id = $1 
         ORDER BY scheduled_for DESC 
         LIMIT 50`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        reminders: reminders.rows,
        total: reminders.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching reminders:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

