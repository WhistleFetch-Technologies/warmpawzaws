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
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

interface SMSTemplate {
  id: string;
  event: string;
  message: string;
  variables: string[];
}

const SMS_TEMPLATES: Record<string, SMSTemplate> = {
  booking_created: {
    id: 'booking_created',
    event: 'booking_created',
    message: 'Hi {customerName}! Your booking {bookingId} for {serviceName} on {date} at {time} is confirmed. Track at warmpawz.com/track/{bookingId}',
    variables: ['customerName', 'bookingId', 'serviceName', 'date', 'time'],
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
  booking_cancelled: {
    id: 'booking_cancelled',
    event: 'booking_cancelled',
    message: 'Booking {bookingId} has been cancelled. Refund of ₹{refundAmount} will be processed in 5-7 days.',
    variables: ['bookingId', 'refundAmount'],
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

    const { booking, customer, vendor, staff, service } = data;

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
    };

    const message = replaceTemplateVariables(template.message, variables);
    const recipientPhone = customer?.phone || booking?.customer_phone;

    if (!recipientPhone) {
      console.warn('No recipient phone number found');
      return;
    }

    // Send SMS
    const snsClient = getSnsClient();
    await snsClient.send(new PublishCommand({
      PhoneNumber: recipientPhone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
      },
    }));

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
      const { phone, message, event, variables } = await c.req.json();

      if (!phone || !message) {
        return c.json({ error: 'phone and message are required' }, 400);
      }

      // Send SMS
      const snsClient = getSnsClient();
      const result = await snsClient.send(new PublishCommand({
        PhoneNumber: phone,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        },
      }));

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
          messageId: result.MessageId,
        },
      }).catch(() => {});

      return c.json({
        success: true,
        messageId: result.MessageId,
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

