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
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

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

// ============================================================================
// GET UPCOMING APPOINTMENTS HANDLER
// ============================================================================

class GetUpcomingAppointmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const withinMinutes = parseInt(context.event.queryStringParameters?.minutes || '60');
    const serviceStyle = context.event.queryStringParameters?.serviceStyle;

    try {
      // Get appointments within the specified time window
      let queryStr = `
        SELECT 
          b.id,
          b.customer_id,
          b.customer_phone,
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

      if (serviceStyle) {
        queryStr += ` AND b.service_type = '${serviceStyle}'`;
      }

      queryStr += ` ORDER BY scheduled_at ASC`;

      const { rows } = await query(queryStr);

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
    const { 
      reminderMinutes = 5, // Default 5 minutes before
      serviceStyles = ['tele'], // Default to tele consultations
      dryRun = false // If true, don't actually send notifications
    } = body;

    try {
      // Get appointments within the reminder window
      const windowStart = reminderMinutes - 1;
      const windowEnd = reminderMinutes + 1;

      const { rows: appointments } = await query(
        `SELECT 
          b.id,
          b.customer_id,
          b.customer_phone,
          c.full_name as customer_name,
          c.fcm_token as customer_fcm_token,
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
          AND b.reminder_sent IS NULL`,
        [serviceStyles, windowStart, windowEnd]
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

        // Create notification for customer
        await insert('notifications', {
          user_id: apt.customer_id,
          user_type: 'customer',
          type: 'appointment_reminder',
          title: '📹 Video Call Starting Soon!',
          message: `Your ${apt.service_name} with ${apt.staff_name || apt.vendor_name} starts in ${reminderMinutes} minutes. Get ready!`,
          data: JSON.stringify({
            booking_id: apt.id,
            type: 'tele_reminder',
            meeting_id: apt.meeting_id,
            action: 'open_chat',
            priority: 'high',
          }),
          is_read: false,
          requires_action: true,
          action_url: `/bookings/${apt.id}`,
          created_at: new Date(),
        });

        // Create notification for staff/vendor
        const staffOrVendorId = apt.staff_user_id || apt.vendor_id;
        if (staffOrVendorId) {
          await insert('notifications', {
            user_id: staffOrVendorId,
            user_type: 'vendor',
            type: 'appointment_reminder',
            title: '📹 Upcoming Video Consultation',
            message: `Consultation with ${apt.customer_name} starts in ${reminderMinutes} minutes.`,
            data: JSON.stringify({
              booking_id: apt.id,
              type: 'tele_reminder',
              meeting_id: apt.meeting_id,
              action: 'open_appointment',
              priority: 'high',
            }),
            is_read: false,
            requires_action: true,
            action_url: `/appointments/${apt.id}`,
            created_at: new Date(),
          });
        }

        // Mark reminder as sent
        await update('bookings', { id: apt.id }, {
          reminder_sent: new Date(),
          reminder_type: `${reminderMinutes}_min`,
        });

        // TODO: Send push notification via FCM
        // if (apt.customer_fcm_token) {
        //   await sendPushNotification(apt.customer_fcm_token, {...});
        // }

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
      }, { requestId: context.event.requestContext?.requestId || crypto.randomUUID() } as any);
      results.push({ type: '5_min_tele', result: JSON.parse(fiveMinResult.body) });

      // 30-minute reminder for home services
      const thirtyMinHandler = new SendPreAppointmentNotificationsHandler();
      const thirtyMinResult = await thirtyMinHandler.execute({
        ...context.event,
        body: JSON.stringify({
          reminderMinutes: 30,
          serviceStyles: ['at_home'],
        }),
      }, { requestId: context.event.requestContext?.requestId || crypto.randomUUID() } as any);
      results.push({ type: '30_min_home', result: JSON.parse(thirtyMinResult.body) });

      // 1-hour reminder for center bookings
      const oneHourHandler = new SendPreAppointmentNotificationsHandler();
      const oneHourResult = await oneHourHandler.execute({
        ...context.event,
        body: JSON.stringify({
          reminderMinutes: 60,
          serviceStyles: ['at_center'],
        }),
      }, { requestId: context.event.requestContext?.requestId || crypto.randomUUID() } as any);
      results.push({ type: '1_hour_center', result: JSON.parse(oneHourResult.body) });

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
      // Get booking details
      const { rows: bookings } = await query(
        `SELECT 
          b.id,
          b.customer_id,
          b.customer_phone,
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

      // Create notification for customer
      await insert('notifications', {
        user_id: apt.customer_id,
        user_type: 'customer',
        type: 'appointment_reminder',
        title: '📹 Video Call Starting Soon!',
        message: `Your ${apt.service_name} with ${apt.staff_name || apt.vendor_name} starts in 5 minutes. Get ready!`,
        data: JSON.stringify({
          booking_id: apt.id,
          type: 'tele_reminder',
          meeting_id: apt.meeting_id,
          action: 'open_chat',
          priority: 'high',
        }),
        is_read: false,
        requires_action: true,
        action_url: `/bookings/${apt.id}`,
        created_at: new Date(),
      });

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
// HONO ROUTER SETUP
// ============================================================================

export function registerAppointmentReminderEndpoints(app: Hono) {
  const getUpcomingHandler = new GetUpcomingAppointmentsHandler();
  const sendRemindersHandler = new SendPreAppointmentNotificationsHandler();
  const scheduledJobHandler = new ScheduledReminderJobHandler();
  const manualTriggerHandler = new ManualTriggerReminderHandler();

  // Get upcoming appointments
  app.get('/reminders/upcoming', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: '/reminders/upcoming',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await getUpcomingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
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
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await sendRemindersHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Scheduled job endpoint (called by CloudWatch Events)
  app.post('/reminders/scheduled-job', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: '/reminders/scheduled-job',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
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
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'appointment-reminders', functionVersion: '$LATEST' };
    const result = await manualTriggerHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
