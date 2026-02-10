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
import { select, insert, query } from '../database/rds-connection';
import { sendSMS } from '../utils/sms-service';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

interface SMSTemplate {
  id: string;
  event: string;
  message: string;
  variables: string[];
  templateId?: string;
}

const SMS_TEMPLATES: Record<string, SMSTemplate> = {
  booking_created: {
    id: 'booking_created',
    event: 'booking_created',
    message: 'Warmpawz Booking: Your booking with {bookingWith} for {bookingDate} at {bookingTime} is confirmed. For more details, refer to My Bookings.',
    variables: ['bookingWith', 'bookingDate', 'bookingTime'],
    templateId: '1207177035174777582',
  },
  payment_confirmed: {
    id: 'payment_confirmed',
    event: 'payment_confirmed',
    message: 'Payment of ₹{amount} received for booking {bookingId}. Receipt: {receiptUrl}',
    variables: ['amount', 'bookingId', 'receiptUrl'],
  },
  staff_assigned: {
    id: 'staff_assigned',
    event: 'staff_assigned',
    message: '{staffName} has been assigned to your booking {bookingId}. Contact: {staffPhone}',
    variables: ['staffName', 'bookingId', 'staffPhone'],
  },
  provider_en_route: {
    id: 'provider_en_route',
    event: 'provider_en_route',
    message: '{providerName} is on the way! Track live location: warmpawz.com/track/{bookingId}',
    variables: ['providerName', 'bookingId'],
  },
  provider_arrived: {
    id: 'provider_arrived',
    event: 'provider_arrived',
    message: '{providerName} has arrived at your location. OTP for verification: {otp}',
    variables: ['providerName', 'otp'],
  },
  service_started: {
    id: 'service_started',
    event: 'service_started',
    message: 'Service started for {petName}. You will receive updates shortly.',
    variables: ['petName'],
  },
  service_completed: {
    id: 'service_completed',
    event: 'service_completed',
    message: 'Service completed for {petName}! OTP for completion: {otp}. Rate your experience: warmpawz.com/review/{bookingId}',
    variables: ['petName', 'otp', 'bookingId'],
  },
  booking_rescheduled: {
    id: 'booking_rescheduled',
    event: 'booking_rescheduled',
    message: 'Warmpawz Rescheduling: Your booking with {bookingWith} has been rescheduled to {bookingDateTime}. For more details, refer to My Bookings.',
    variables: ['bookingWith', 'bookingDateTime'],
    templateId: '1207177035515118051',
  },
  booking_cancelled: {
    id: 'booking_cancelled',
    event: 'booking_cancelled',
    message: 'Warmpawz Cancellation: Your booking with {bookingWith} scheduled for {bookingDateTime} has been cancelled. For more details, refer to My Bookings.',
    variables: ['bookingWith', 'bookingDateTime'],
    templateId: '1207177035326314961',
  },
  refund_processed: {
    id: 'refund_processed',
    event: 'refund_processed',
    message: 'Refund of ₹{amount} for booking {bookingId} has been processed to your account.',
    variables: ['amount', 'bookingId'],
  },
  review_request: {
    id: 'review_request',
    event: 'review_request',
    message: 'How was your experience with {providerName}? Share your feedback: warmpawz.com/review/{bookingId}',
    variables: ['providerName', 'bookingId'],
  },
  delivery_dispatched: {
    id: 'delivery_dispatched',
    event: 'delivery_dispatched',
    message: 'Your order {orderId} has been dispatched. Track: warmpawz.com/track/{orderId}',
    variables: ['orderId'],
  },
  delivery_arrived: {
    id: 'delivery_arrived',
    event: 'delivery_arrived',
    message: 'Your order {orderId} has arrived! OTP for delivery: {otp}',
    variables: ['orderId', 'otp'],
  },
};

const JIO_APPROVED_EVENTS = new Set(['booking_created', 'booking_rescheduled', 'booking_cancelled']);

function sanitizeAlphanumeric(value: string, maxLen: number = 40): string {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9\s:-]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || ''));
  }
  return message;
}

export async function triggerBookingNotification(event: string, data: any) {
  try {
    console.log(`🔔 Triggering SMS notification for event: ${event}`);

    const template = SMS_TEMPLATES[event];
    if (!template) {
      console.warn(`No SMS template found for event: ${event}`);
      return;
    }

    const isUatMode = process.env.UAT_MODE === 'true';
    if (!isUatMode && !template.templateId && !JIO_APPROVED_EVENTS.has(event)) {
      console.warn(`[SMS] Skipping non-approved template for event: ${event} (DLT compliance)`);
      return;
    }

    const { booking, customer, vendor, staff, service } = data;
    const bookingWith = sanitizeAlphanumeric(
      vendor?.business_name || service?.name || booking?.service_type || 'Service'
    );
    const bookingDate = sanitizeAlphanumeric(booking?.booking_date || '');
    const bookingTime = sanitizeAlphanumeric(booking?.booking_time || '');
    const bookingDateTime = sanitizeAlphanumeric(
      bookingDate && bookingTime ? `${bookingDate} at ${bookingTime}` : (bookingDate || bookingTime || '')
    );

    // Build variables object
    const variables: Record<string, any> = {
      customerName: customer?.name || customer?.phone || 'Customer',
      bookingId: booking?.id || booking?.order_number || '',
      serviceName: service?.name || 'Service',
      date: booking?.booking_date || '',
      time: booking?.booking_time || '',
      amount: booking?.total_amount || booking?.amount || '0',
      receiptUrl: booking?.receipt_url || '',
      staffName: staff?.name || 'Staff',
      staffPhone: staff?.phone || '',
      providerName: vendor?.business_name || vendor?.owner_name || 'Provider',
      petName: booking?.pet_name || 'Pet',
      otp: booking?.otp_code || '',
      refundAmount: booking?.refund_amount || '0',
      orderId: booking?.order_id || booking?.id || '',
      bookingWith,
      bookingDate,
      bookingTime,
      bookingDateTime,
    };

    const message = replaceTemplateVariables(template.message, variables);
    const recipientPhone = customer?.phone || booking?.customer_phone;

    if (!recipientPhone) {
      console.warn('No recipient phone number found');
      return;
    }

    // Send SMS
    await sendSMS({
      to: recipientPhone,
      message,
      type: 'transactional',
      ...(template.templateId ? { templateId: template.templateId } : {}),
    });

    // Log notification
    await insert('notifications', {
      user_id: customer?.id || booking?.customer_id,
      user_type: 'customer',
      title: template.event,
      message: message,
      notification_type: 'sms',
      is_read: false,
      metadata: {
        event,
        bookingId: booking?.id,
        sentVia: 'sms',
      },
    }).catch(err => console.error('Failed to log notification:', err));

    console.log(`✅ SMS sent to ${recipientPhone} for event: ${event}`);
  } catch (error) {
    console.error('Error triggering SMS notification:', error);
  }
}

export function registerSmsNotificationEndpoints(app: Hono) {
  /**
   * POST /sms/send
   * Send SMS notification manually
   */
  app.post("/sms/send", async (c) => {
    try {
      const { phone, message, event, variables, templateId } = await c.req.json();

      if (!phone || !message) {
        return c.json({ error: 'phone and message are required' }, 400);
      }

      const isUatMode = process.env.UAT_MODE === 'true';
      if (!isUatMode && !templateId) {
        return c.json({ error: 'templateId is required for SMS in production (DLT compliance)' }, 400);
      }

      // Send SMS
      const result = await sendSMS({
        to: phone,
        message,
        type: 'transactional',
        ...(templateId ? { templateId } : {}),
      });

      // Log notification
      await insert('notifications', {
        user_id: null,
        user_type: 'customer',
        title: event || 'sms_notification',
        message: message,
        notification_type: 'sms',
        is_read: false,
        metadata: {
          event,
          phone,
          messageId: result.messageId,
        },
      }).catch(() => {});

      return c.json({
        success: true,
        messageId: result.messageId,
        message: 'SMS sent successfully',
      });
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /sms/trigger-event
   * Trigger SMS notification for a booking event
   */
  app.post("/sms/trigger-event", async (c) => {
    try {
      const { event, bookingId, data } = await c.req.json();

      if (!event || !bookingId) {
        return c.json({ error: 'event and bookingId are required' }, 400);
      }

      // Get booking and related data
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get customer
      const customers = await select('customers', { id: booking.customer_id });
      const customer = customers.length > 0 ? customers[0] : null;

      // Get vendor
      const vendors = booking.vendor_id ? await select('vendors', { id: booking.vendor_id }) : [];
      const vendor = vendors.length > 0 ? vendors[0] : null;

      // Get staff
      const staff = booking.staff_id ? await select('staff', { id: booking.staff_id }) : [];
      const staffMember = staff.length > 0 ? staff[0] : null;

      // Get service
      const services = await select('services', { id: booking.service_id });
      const service = services.length > 0 ? services[0] : null;

      // Trigger notification
      await triggerBookingNotification(event, {
        booking,
        customer,
        vendor,
        staff: staffMember,
        service,
        ...data,
      });

      return c.json({
        success: true,
        message: 'SMS notification triggered',
      });
    } catch (error: any) {
      console.error('Error triggering SMS event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /sms/templates
   * Get all SMS templates
   */
  app.get("/sms/templates", async (c) => {
    return c.json({
      success: true,
      templates: Object.values(SMS_TEMPLATES),
    });
  });

  /**
   * GET /sms/history
   * Get SMS notification history
   */
  app.get("/sms/history", async (c) => {
    try {
      const { userId, limit = 50, offset = 0 } = c.req.query();

      let queryText = `SELECT * FROM notifications WHERE notification_type = 'sms'`;
      const params: any[] = [];
      let paramIndex = 1;

      if (userId) {
        queryText += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        notifications: result.rows,
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching SMS history:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
