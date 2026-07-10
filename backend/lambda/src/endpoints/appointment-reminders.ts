/**
 * ============================================================================
 * APPOINTMENT REMINDERS ENDPOINTS
 * ============================================================================
 * 
 * Handles pre-appointment notifications and reminders
 * - 5-minute pre-appointment notification for video consultations
 * - 30-minute and 1-hour reminders for all bookings
 * - Manual trigger for testing
 * - Scheduled job integration
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { getDiscoveryRules } from '../lib/rule-engine';
import { sendEventNotification } from '../aws/aws-sns-notification-service';
import { dispatchNotification } from '../utils/notification-dispatch';
import {
  cronPipelineSkippedPayload,
  isNotificationCronEnabled,
} from '../utils/notification-pipeline-kill-switch';

// ============================================================================
// TYPES
// ============================================================================

interface UpcomingAppointment {
  id: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  staffId?: string;
  staffName?: string;
  serviceName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  bookingDate: string;
  bookingTime: string;
  scheduledAt: Date;
  minutesUntil: number;
}

async function deliverAppointmentReminder(apt: Record<string, any>, reminderMinutes: number): Promise<void> {
  const isTeleFiveMin = apt.service_style === 'tele' && reminderMinutes <= 5;
  const eventType = isTeleFiveMin ? 'video_call_reminder_5min' : 'booking_reminder';
  const providerName = apt.staff_name || apt.vendor_name || 'Provider';
  const dedupeSuffix = `${reminderMinutes}min`;

  if (apt.customer_id) {
    await sendEventNotification({
      eventType,
      recipientId: String(apt.customer_id),
      recipientType: 'customer',
      relatedId: apt.id,
      data: {
        vendorName: providerName,
        serviceName: apt.service_name,
        timeLeft: `${reminderMinutes} minutes`,
        bookingId: apt.id,
        meetingId: apt.meeting_id,
        dedupeKey: `booking-${apt.id}-reminder-${dedupeSuffix}-customer`,
      },
    });
  }

  if (apt.vendor_id) {
    const title = isTeleFiveMin ? 'Upcoming Video Consultation' : 'Upcoming Appointment';
    const message = isTeleFiveMin
      ? `Consultation with ${apt.customer_name} starts in ${reminderMinutes} minutes.`
      : `Appointment with ${apt.customer_name} starts in ${reminderMinutes} minutes.`;
    await dispatchNotification({
      recipientId: String(apt.vendor_id),
      recipientType: 'vendor',
      notificationType: eventType,
      title,
      message,
      channels: { inApp: true, push: true },
      priority: 'high',
      data: {
        bookingId: apt.id,
        customerName: apt.customer_name,
        meetingId: apt.meeting_id,
        dedupeKey: `booking-${apt.id}-reminder-${dedupeSuffix}-vendor`,
      },
    });
  }
}

// ============================================================================
// GET UPCOMING APPOINTMENTS HANDLER
// ============================================================================

class GetUpcomingAppointmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const withinMinutes = parseInt(context.event.queryStringParameters?.minutes || '60');
    const serviceStyle = context.event.queryStringParameters?.serviceStyle;

    try {
      // ✅ FIX: Use customer phone from customers table (b.customer_phone column doesn't exist)
      let queryStr = `
        SELECT 
          b.id,
          b.customer_id,
          c.phone as customer_phone,
          c.full_name as customer_name,
          b.vendor_id,
          v.business_name as vendor_name,
          b.staff_id,
          s.name as staff_name,
          vs.service_name as service_name,
          b.service_type as service_style,
          b.booking_date,
          b.booking_time,
          b.booking_date + b.booking_time::time as scheduled_at,
          EXTRACT(EPOCH FROM ((b.booking_date + b.booking_time::time) - NOW())) / 60 as minutes_until
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN vendors v ON v.id = b.vendor_id
        LEFT JOIN staff s ON s.id = b.staff_id
        LEFT JOIN vendor_services vs ON vs.id = b.service_id
        WHERE b.status IN ('confirmed', 'scheduled', 'pending')
          AND b.booking_date + b.booking_time::time > NOW()
          AND b.booking_date + b.booking_time::time <= NOW() + INTERVAL '${withinMinutes} minutes'
      `;

      const params: any[] = [];
      if (serviceStyle) {
        // Check both service_type and service_style (different booking flows use different columns)
        queryStr += ` AND (b.service_type = $1 OR b.service_style = $1)`;
        params.push(serviceStyle);
      }

      queryStr += ` ORDER BY scheduled_at ASC`;

      const { rows } = await query(queryStr, params.length > 0 ? params : undefined);

      const appointments: UpcomingAppointment[] = rows.map(row => ({
        id: row.id,
        customerId: row.customer_id,
        customerPhone: row.customer_phone,
        customerName: row.customer_name || 'Customer',
        vendorId: row.vendor_id,
        vendorName: row.vendor_name || 'Provider',
        staffId: row.staff_id,
        staffName: row.staff_name,
        serviceName: row.service_name || 'Consultation',
        serviceStyle: row.service_style || 'at_center',
        bookingDate: row.booking_date,
        bookingTime: row.booking_time,
        scheduledAt: row.scheduled_at,
        minutesUntil: Math.round(parseFloat(row.minutes_until)),
      }));

      return this.success({
        success: true,
        appointments,
        count: appointments.length,
        withinMinutes,
      });
    } catch (error: any) {
      console.error('Error getting upcoming appointments:', error);
      return this.error(error.message || 'Failed to get appointments', 500);
    }
  }
}

// ============================================================================
// SEND PRE-APPOINTMENT NOTIFICATIONS HANDLER
// ============================================================================

class SendPreAppointmentNotificationsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const rules = await getDiscoveryRules('all', 'booking');
    const defaultReminderMinutes = rules.appointment_reminder_minutes_before ?? 5;
    const { 
      reminderMinutes = defaultReminderMinutes, // Rule engine: appointment_reminder_minutes_before
      serviceStyles = ['tele'], // Default to tele consultations
      dryRun = false // If true, don't actually send notifications
    } = body;

    try {
      // Get appointments within the reminder window
      const windowStart = reminderMinutes - 1;
      const windowEnd = reminderMinutes + 1;

      // ✅ FIX: Use customer phone from customers table (b.customer_phone column doesn't exist)
      // ✅ FIX: fcm_token column doesn't exist, make it optional
      const { rows: appointments } = await query(
        `SELECT 
          b.id,
          b.customer_id,
          c.phone as customer_phone,
          c.full_name as customer_name,
          NULL as customer_fcm_token,
          b.vendor_id,
          v.business_name as vendor_name,
          b.staff_id,
          s.name as staff_name,
          s.user_id as staff_user_id,
          vs.service_name as service_name,
          b.service_type as service_style,
          b.booking_date,
          b.booking_time,
          b.meeting_id,
          EXTRACT(EPOCH FROM ((b.booking_date + b.booking_time::time) - NOW())) / 60 as minutes_until
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN vendors v ON v.id = b.vendor_id
        LEFT JOIN staff s ON s.id = b.staff_id
        LEFT JOIN vendor_services vs ON vs.id = b.service_id
        WHERE b.status IN ('confirmed', 'scheduled')
          AND b.service_type = ANY($1::text[])
          AND EXTRACT(EPOCH FROM ((b.booking_date + b.booking_time::time) - NOW())) / 60 BETWEEN $2 AND $3
          AND (
            ($4::int <= 5 AND COALESCE(b.reminder_5min_sent, false) = false)
            OR ($4::int > 5 AND COALESCE(b.reminder_sent, false) = false)
          )`,
        [serviceStyles, windowStart, windowEnd, reminderMinutes]
      );

      if (appointments.length === 0) {
        return this.success({
          success: true,
          message: 'No appointments need reminders',
          notificationsSent: 0,
        });
      }

      const notificationsSent: any[] = [];

      for (const apt of appointments) {
        if (dryRun) {
          notificationsSent.push({
            bookingId: apt.id,
            type: 'dry_run',
            customer: apt.customer_name,
            vendor: apt.vendor_name,
            minutesUntil: Math.round(parseFloat(apt.minutes_until)),
          });
          continue;
        }

        await deliverAppointmentReminder(apt, reminderMinutes);

        const updateData: Record<string, unknown> = {
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString(),
        };

        if (apt.service_style === 'tele' && reminderMinutes <= 5) {
          updateData.chat_activated_at = new Date();
          updateData.chat_auto_activated = true;
          updateData.reminder_5min_sent = true;
          updateData.reminder_5min_sent_at = new Date().toISOString();

          await insert('chat_messages', {
            booking_id: apt.id,
            sender_type: 'system',
            message: `Chat activated! Your video consultation starts in ${reminderMinutes} minutes. You can now message each other before the call.`,
            is_read: false,
            created_at: new Date(),
          }).catch(() => {
            console.log('Could not create system chat message');
          });
        }

        await update('bookings', { id: apt.id }, updateData);

        notificationsSent.push({
          bookingId: apt.id,
          customer: apt.customer_name,
          vendor: apt.vendor_name,
          minutesUntil: Math.round(parseFloat(apt.minutes_until)),
        });
      }

      return this.success({
        success: true,
        message: `Sent ${notificationsSent.length} pre-appointment notifications`,
        notificationsSent: notificationsSent.length,
        details: notificationsSent,
      });
    } catch (error: any) {
      console.error('Error sending pre-appointment notifications:', error);
      return this.error(error.message || 'Failed to send notifications', 500);
    }
  }
}

// ============================================================================
// SCHEDULED JOB HANDLER - Called by CloudWatch Events/EventBridge
// ============================================================================

class ScheduledReminderJobHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const results: any[] = [];

      // 5-minute reminder for tele consultations
      const fiveMinHandler = new SendPreAppointmentNotificationsHandler();
      const fiveMinResult = await fiveMinHandler.execute({
        ...context.event,
        body: JSON.stringify({
          reminderMinutes: 5,
          serviceStyles: ['tele'],
        }),
      }, { requestId: context.event.requestContext?.requestId || randomUUID() } as any);
      results.push({ type: '5_min_tele', result: JSON.parse(fiveMinResult.body) });

      // 30-minute reminder for home services
      const thirtyMinHandler = new SendPreAppointmentNotificationsHandler();
      const thirtyMinResult = await thirtyMinHandler.execute({
        ...context.event,
        body: JSON.stringify({
          reminderMinutes: 30,
          serviceStyles: ['at_home'],
        }),
      }, { requestId: context.event.requestContext?.requestId || randomUUID() } as any);
      results.push({ type: '30_min_home', result: JSON.parse(thirtyMinResult.body) });

      // 1-hour reminder for center bookings
      const oneHourHandler = new SendPreAppointmentNotificationsHandler();
      const oneHourResult = await oneHourHandler.execute({
        ...context.event,
        body: JSON.stringify({
          reminderMinutes: 60,
          serviceStyles: ['at_center'],
        }),
      }, { requestId: context.event.requestContext?.requestId || randomUUID() } as any);
      results.push({ type: '1_hour_center', result: JSON.parse(oneHourResult.body) });

      const { processServiceStartOtpNotifications } = await import('../utils/service-start-otp-job');
      const startOtpResult = await processServiceStartOtpNotifications();
      results.push({ type: 'service_start_otp', result: startOtpResult });

      return this.success({
        success: true,
        message: 'Scheduled reminder job completed',
        results,
      });
    } catch (error: any) {
      console.error('Error in scheduled reminder job:', error);
      return this.error(error.message || 'Scheduled job failed', 500);
    }
  }
}

// ============================================================================
// MANUAL TRIGGER FOR TESTING
// ============================================================================

class ManualTriggerReminderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      // ✅ FIX: Use customer phone from customers table (b.customer_phone column doesn't exist)
      // Get booking details
      const { rows: bookings } = await query(
        `SELECT 
          b.id,
          b.customer_id,
          c.phone as customer_phone,
          c.full_name as customer_name,
          b.vendor_id,
          v.business_name as vendor_name,
          b.staff_id,
          s.name as staff_name,
          vs.service_name as service_name,
          b.service_type as service_style,
          b.booking_date,
          b.booking_time,
          b.meeting_id
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN vendors v ON v.id = b.vendor_id
        LEFT JOIN staff s ON s.id = b.staff_id
        LEFT JOIN vendor_services vs ON vs.id = b.service_id
        WHERE b.id = $1`,
        [bookingId]
      );

      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }

      const apt = bookings[0];
      await deliverAppointmentReminder(apt, 5);
      await update('bookings', { id: apt.id }, {
        reminder_5min_sent: true,
        reminder_5min_sent_at: new Date().toISOString(),
        reminder_sent: true,
        reminder_sent_at: new Date().toISOString(),
      }).catch(() => undefined);

      return this.success({
        success: true,
        message: 'Manual reminder sent',
        booking: {
          id: apt.id,
          customer: apt.customer_name,
          vendor: apt.vendor_name,
          service: apt.service_name,
        },
      });
    } catch (error: any) {
      console.error('Error sending manual reminder:', error);
      return this.error(error.message || 'Failed to send reminder', 500);
    }
  }
}

// ============================================================================
// CHECK CHAT ACTIVATION STATUS (GAP FIX)
// ============================================================================

class CheckChatActivationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const { rows: bookings } = await query(
        `SELECT 
          b.id,
          b.service_type as service_style,
          b.chat_activated_at,
          b.chat_auto_activated,
          b.booking_date,
          b.booking_time,
          b.booking_date + b.booking_time::time as scheduled_at,
          EXTRACT(EPOCH FROM ((b.booking_date + b.booking_time::time) - NOW())) / 60 as minutes_until,
          b.meeting_id,
          v.business_name as vendor_name,
          s.name as staff_name
        FROM bookings b
        LEFT JOIN vendors v ON v.id = b.vendor_id
        LEFT JOIN staff s ON s.id = b.staff_id
        WHERE b.id = $1`,
        [bookingId]
      );

      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }

      const booking = bookings[0];
      const minutesUntil = Math.round(parseFloat(booking.minutes_until));
      const isTele = booking.service_style === 'tele';
      
      // Chat is active if:
      // 1. Already activated via reminder, OR
      // 2. It's a tele consultation and within 5 minutes of start
      const isChatActive = booking.chat_auto_activated || 
                          (isTele && minutesUntil <= 5 && minutesUntil >= -30);
      
      // Determine if we should show the reminder notification
      // Show between 5 minutes before and start time
      const showTeleReminder = isTele && minutesUntil <= 5 && minutesUntil > 0;

      return this.success({
        success: true,
        bookingId,
        isChatActive,
        chatActivatedAt: booking.chat_activated_at,
        wasAutoActivated: booking.chat_auto_activated,
        isTeleConsultation: isTele,
        minutesUntilAppointment: minutesUntil,
        showTeleReminder,
        meetingId: booking.meeting_id,
        providerName: booking.staff_name || booking.vendor_name,
      });
    } catch (error: any) {
      console.error('Error checking chat activation:', error);
      return this.error(error.message || 'Failed to check chat status', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerAppointmentReminderEndpoints(app: Hono) {
  const getUpcomingHandler = new GetUpcomingAppointmentsHandler();
  const sendRemindersHandler = new SendPreAppointmentNotificationsHandler();
  const scheduledJobHandler = new ScheduledReminderJobHandler();
  const manualTriggerHandler = new ManualTriggerReminderHandler();
  const checkChatHandler = new CheckChatActivationHandler(); // GAP FIX

  // Check chat activation status (GAP FIX)
  app.get('/reminders/chat-status/:bookingId', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/reminders/chat-status/${c.req.param('bookingId')}`,
      headers: {},
      body: '',
      pathParameters: { bookingId: c.req.param('bookingId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await checkChatHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get upcoming appointments
  app.get('/reminders/upcoming', async (c) => {
    try {
      const event = {
        httpMethod: 'GET',
        path: '/reminders/upcoming',
        headers: {},
        body: '',
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
        requestContext: { requestId: randomUUID() },
      };
      const context = { requestId: randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
      const result = await getUpcomingHandler.execute(event, context);
      // Graceful degradation: return 200 with empty on 4xx/5xx so customer home loads
      if (result.statusCode >= 400) {
        return c.json({ success: true, reminders: [] }, 200);
      }
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('[reminders/upcoming] Error:', error);
      return c.json({ success: true, reminders: [] }, 200);
    }
  });

  // Send pre-appointment notifications
  app.post('/reminders/send', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = {
      httpMethod: 'POST',
      path: '/reminders/send',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await sendRemindersHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Scheduled job endpoint (called by CloudWatch Events)
  app.post('/reminders/scheduled-job', async (c) => {
    if (!isNotificationCronEnabled()) {
      return c.json(cronPipelineSkippedPayload());
    }
    const event = {
      httpMethod: 'POST',
      path: '/reminders/scheduled-job',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await scheduledJobHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Manual trigger for testing
  app.post('/reminders/manual/:bookingId', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: `/reminders/manual/${c.req.param('bookingId')}`,
      headers: {},
      body: '',
      pathParameters: { bookingId: c.req.param('bookingId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await manualTriggerHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
