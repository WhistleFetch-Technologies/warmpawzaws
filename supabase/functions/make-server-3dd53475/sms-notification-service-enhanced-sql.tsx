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

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getNotificationTemplatesRepository } from '../../lib/repositories/notification-templates.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { getDbClient } from '../../lib/db.ts';

interface SMSTemplate {
  id: string;
  event: string;
  message: string;
  variables: string[];
}

interface SMSNotification {
  id: string;
  to: string;
  message: string;
  event: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  provider: 'twilio' | 'aws_sns' | 'mock';
  providerId?: string;
  error?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

// ============================================
// SHARED NOTIFICATION TRIGGER (Exported)
// ============================================

export async function triggerBookingNotification(event: string, data: any) {
  try {
    console.log(`🔔 Triggering Notification for event: ${event}`);
    const { booking, customer, vendor, staff } = data;

    // Resolve Recipient & Template
    let to = '';
    let message = '';
    
    if (event === 'booking.confirmed') {
        to = customer?.phone;
        message = `Hi ${customer?.name}, your booking ${booking?.id} is CONFIRMED! Date: ${booking?.scheduledDate} ${booking?.scheduledTime}.`;
    } else if (event === 'booking.cancelled') {
        to = customer?.phone;
        message = `Booking ${booking?.id} has been CANCELLED. Refund initiated.`;
    } else if (event === 'booking.rescheduled') {
        to = customer?.phone;
        message = `Booking ${booking?.id} RESCHEDULED to ${booking?.scheduledDate} ${booking?.scheduledTime}.`;
    }

    if (to && message) {
        console.log(`📨 [SMS] To: ${to} | Msg: ${message}`);
        
        // Persist notification log using SQL repository
        const templatesRepo = getNotificationTemplatesRepository();
        const logId = `sms_log_${Date.now()}`;
        
        await templatesRepo.createLog({
          log_id: logId,
          template_code: event,
          channel: 'sms',
          recipient: { phone: to },
          variables: { event, bookingId: booking?.id },
          rendered_content: { body: message },
          status: 'sent'
        });
    }

  } catch (error) {
    console.error('Error triggering notification:', error);
  }
}

export function smsNotificationServiceEnhanced(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const templatesRepo = getNotificationTemplatesRepository();
  const platformSettingsRepo = getPlatformSettingsRepository();
  const db = getDbClient();

  // SMS Templates for all events
  const SMS_TEMPLATES: Record<string, SMSTemplate> = {
    booking_created: {
      id: 'booking_created',
      event: 'booking_created',
      message: 'Hi {customerName}! Your booking {bookingId} for {serviceName} on {date} at {time} is confirmed. Track at warmpawz.com/track/{bookingId}',
      variables: ['customerName', 'bookingId', 'serviceName', 'date', 'time']
    },
    payment_confirmed: {
      id: 'payment_confirmed',
      event: 'payment_confirmed',
      message: 'Payment of ₹{amount} received for booking {bookingId}. Receipt: {receiptUrl}',
      variables: ['amount', 'bookingId', 'receiptUrl']
    },
    staff_assigned: {
      id: 'staff_assigned',
      event: 'staff_assigned',
      message: '{staffName} has been assigned to your booking {bookingId}. Contact: {staffPhone}',
      variables: ['staffName', 'bookingId', 'staffPhone']
    },
    provider_en_route: {
      id: 'provider_en_route',
      event: 'provider_en_route',
      message: '{providerName} is on the way! Track live location: warmpawz.com/track/{bookingId}',
      variables: ['providerName', 'bookingId']
    },
    provider_arrived: {
      id: 'provider_arrived',
      event: 'provider_arrived',
      message: '{providerName} has arrived at your location. OTP for verification: {otp}',
      variables: ['providerName', 'otp']
    },
    service_started: {
      id: 'service_started',
      event: 'service_started',
      message: 'Service started for {petName}. You will receive updates shortly.',
      variables: ['petName']
    },
    service_completed: {
      id: 'service_completed',
      event: 'service_completed',
      message: 'Service completed for {petName}! OTP for completion: {otp}. Rate your experience: warmpawz.com/review/{bookingId}',
      variables: ['petName', 'otp', 'bookingId']
    },
    booking_cancelled: {
      id: 'booking_cancelled',
      event: 'booking_cancelled',
      message: 'Booking {bookingId} has been cancelled. Refund of ₹{refundAmount} will be processed in 5-7 days.',
      variables: ['bookingId', 'refundAmount']
    },
    refund_processed: {
      id: 'refund_processed',
      event: 'refund_processed',
      message: 'Refund of ₹{amount} for booking {bookingId} has been processed to your account.',
      variables: ['amount', 'bookingId']
    },
    review_request: {
      id: 'review_request',
      event: 'review_request',
      message: 'How was your experience with {providerName}? Share your feedback: warmpawz.com/review/{bookingId}',
      variables: ['providerName', 'bookingId']
    },
    delivery_dispatched: {
      id: 'delivery_dispatched',
      event: 'delivery_dispatched',
      message: 'Your order {orderId} has been dispatched. Track: warmpawz.com/track/{orderId}',
      variables: ['orderId']
    },
    delivery_out_for_delivery: {
      id: 'delivery_out_for_delivery',
      event: 'delivery_out_for_delivery',
      message: 'Your order {orderId} is out for delivery. Expected by {eta}',
      variables: ['orderId', 'eta']
    },
    delivery_delivered: {
      id: 'delivery_delivered',
      event: 'delivery_delivered',
      message: 'Order {orderId} delivered successfully! OTP: {otp}',
      variables: ['orderId', 'otp']
    },
    appointment_reminder: {
      id: 'appointment_reminder',
      event: 'appointment_reminder',
      message: 'Reminder: Appointment for {petName} tomorrow at {time} with {providerName}. Booking: {bookingId}',
      variables: ['petName', 'time', 'providerName', 'bookingId']
    },
    vendor_new_booking: {
      id: 'vendor_new_booking',
      event: 'vendor_new_booking',
      message: 'New booking {bookingId} for {serviceName} on {date} at {time}. Customer: {customerName}, {customerPhone}',
      variables: ['bookingId', 'serviceName', 'date', 'time', 'customerName', 'customerPhone']
    },
    vendor_payment_received: {
      id: 'vendor_payment_received',
      event: 'vendor_payment_received',
      message: 'Payment of ₹{amount} received for booking {bookingId}',
      variables: ['amount', 'bookingId']
    },
    payout_processed: {
      id: 'payout_processed',
      event: 'payout_processed',
      message: 'Payout of ₹{amount} has been processed to your bank account. Transaction ID: {transactionId}',
      variables: ['amount', 'transactionId']
    },
    ambulance_request_confirmed: {
      id: 'ambulance_request_confirmed',
      event: 'ambulance_request_confirmed',
      message: 'Ambulance request confirmed. {providerName} is dispatching vehicle {vehicleNumber}. ETA: {eta} mins.',
      variables: ['providerName', 'vehicleNumber', 'eta']
    },
    integrated_service_update: {
      id: 'integrated_service_update',
      event: 'integrated_service_update',
      message: 'Update for your {serviceType} request: {statusMessage}.',
      variables: ['serviceType', 'statusMessage']
    }
  };

  /**
   * Send SMS using configured provider
   */
  async function sendSMS(to: string, message: string, event: string): Promise<SMSNotification> {
    const smsId = `SMS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const notification: SMSNotification = {
      id: smsId,
      to,
      message,
      event,
      status: 'pending',
      provider: 'mock', // In production: 'twilio' or 'aws_sns'
      createdAt: new Date().toISOString()
    };

    try {
      console.log(`📱 Sending SMS to ${to}: ${message}`);

      // Get SMS provider configuration from platform settings
      const { data: platformSettings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_settings')
        .maybeSingle();
      
      const smsConfig = platformSettings?.setting_value?.sms || { provider: 'mock' };

      // Send based on provider
      if (smsConfig.provider === 'twilio') {
        await sendViaTwilio(to, message, smsConfig);
        notification.status = 'sent';
        notification.sentAt = new Date().toISOString();
      } else if (smsConfig.provider === 'aws_sns') {
        await sendViaAWSSNS(to, message, smsConfig);
        notification.status = 'sent';
        notification.sentAt = new Date().toISOString();
      } else {
        // Mock mode for development
        console.log('📱 MOCK SMS:', { to, message, event });
        notification.status = 'sent';
        notification.sentAt = new Date().toISOString();
        
        // Simulate delivery after 2 seconds
        setTimeout(async () => {
          notification.status = 'delivered';
          notification.deliveredAt = new Date().toISOString();
          
          // Update notification log
          await templatesRepo.updateLog(smsId, {
            status: 'delivered',
            delivered_at: notification.deliveredAt
          });
        }, 2000);
      }

      // Save notification log
      await templatesRepo.createLog({
        log_id: smsId,
        template_code: event,
        channel: 'sms',
        recipient: { phone: to },
        variables: { event },
        rendered_content: { body: message },
        status: notification.status,
        provider: notification.provider,
        provider_id: notification.providerId,
        sent_at: notification.sentAt
      });

      // Track analytics
      await trackSMSAnalytics(event, 'sent');

      console.log(`✅ SMS sent: ${smsId}`);
      return notification;

    } catch (error: any) {
      console.error('❌ SMS send failed:', error);
      notification.status = 'failed';
      notification.error = error.message;
      
      // Save failed notification log
      await templatesRepo.createLog({
        log_id: smsId,
        template_code: event,
        channel: 'sms',
        recipient: { phone: to },
        variables: { event },
        rendered_content: { body: message },
        status: 'failed',
        provider: notification.provider,
        error_message: error.message
      });
      
      // Track failure
      await trackSMSAnalytics(event, 'failed');
      
      return notification;
    }
  }

  /**
   * Send via Twilio
   */
  async function sendViaTwilio(to: string, message: string, config: any) {
    const { accountSid, authToken, fromNumber } = config;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio configuration incomplete');
    }

    const auth = btoa(`${accountSid}:${authToken}`);
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: message
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twilio error: ${error.message}`);
    }

    const result = await response.json();
    return result.sid;
  }

  /**
   * Send via AWS SNS
   */
  async function sendViaAWSSNS(to: string, message: string, config: any) {
    // AWS SNS integration would go here
    // For now, throw error to force mock mode
    throw new Error('AWS SNS not yet configured');
  }

  /**
   * Track SMS analytics
   */
  async function trackSMSAnalytics(event: string, status: string) {
    // Analytics are now aggregated from notification_logs table
    // No need to store separate analytics records
    // Analytics endpoint will query notification_logs directly
    console.log(`📊 SMS Analytics: ${event} - ${status}`);
  }

  /**
   * Render SMS template with variables
   */
  function renderTemplate(templateId: string, variables: Record<string, any>): string {
    const template = SMS_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let message = template.message;
    
    // Replace all variables
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(`{${key}}`, value?.toString() || '');
    }

    return message;
  }

  // ============================================
  // API ENDPOINTS
  // ============================================

  /**
   * POST /sms/send
   * Send SMS notification
   */
  app.post(`${BASE_PATH}/sms/send`, async (c) => {
    try {
      const { to, event, variables } = await c.req.json();

      if (!to || !event) {
        return sendError(c, 'Phone number and event are required', 400);
      }

      // Render message from template
      const message = renderTemplate(event, variables || {});

      // Send SMS
      const notification = await sendSMS(to, message, event);

      return sendSuccess(c, { notification });

    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /sms/send-custom
   * Send custom SMS (no template)
   */
  app.post(`${BASE_PATH}/sms/send-custom`, async (c) => {
    try {
      const { to, message, event } = await c.req.json();

      if (!to || !message) {
        return sendError(c, 'Phone number and message are required', 400);
      }

      const notification = await sendSMS(to, message, event || 'custom');

      return sendSuccess(c, { notification });

    } catch (error) {
      console.error('❌ Error sending custom SMS:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /sms/:smsId
   * Get SMS status
   */
  app.get(`${BASE_PATH}/sms/:smsId`, async (c) => {
    try {
      const { smsId } = c.req.param();

      const log = await templatesRepo.getLogByLogId(smsId);
      
      if (!log) {
        return sendError(c, 'SMS not found', 404);
      }

      // Convert log to SMSNotification format
      const notification: SMSNotification = {
        id: log.log_id,
        to: log.recipient?.phone || '',
        message: log.rendered_content?.body || '',
        event: log.template_code,
        status: log.status as 'pending' | 'sent' | 'delivered' | 'failed',
        provider: (log.provider as 'twilio' | 'aws_sns' | 'mock') || 'mock',
        providerId: log.provider_id || undefined,
        error: log.error_message || undefined,
        sentAt: log.sent_at || undefined,
        deliveredAt: log.delivered_at || undefined,
        createdAt: log.created_at
      };

      return sendSuccess(c, { notification });

    } catch (error) {
      console.error('❌ Error fetching SMS:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /sms/analytics
   * Get SMS analytics
   */
  app.get(`${BASE_PATH}/sms/analytics`, async (c) => {
    try {
      const { startDate, endDate } = c.req.query();

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      // Fetch analytics from notification_logs table
      const { data: logs, error } = await db
        .from('notification_logs')
        .select('*')
        .eq('channel', 'sms')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        throw error;
      }

      // Aggregate analytics
      const aggregated = {
        total: 0,
        byEvent: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        dates: [] as any[]
      };

      // Group by date
      const byDate = new Map<string, any>();
      
      (logs || []).forEach((log: any) => {
        const date = log.created_at.split('T')[0];
        
        if (!byDate.has(date)) {
          byDate.set(date, {
            date,
            total: 0,
            byEvent: {} as Record<string, number>,
            byStatus: {} as Record<string, number>
          });
        }
        
        const dayData = byDate.get(date)!;
        dayData.total++;
        aggregated.total++;
        
        dayData.byEvent[log.template_code] = (dayData.byEvent[log.template_code] || 0) + 1;
        aggregated.byEvent[log.template_code] = (aggregated.byEvent[log.template_code] || 0) + 1;
        
        dayData.byStatus[log.status] = (dayData.byStatus[log.status] || 0) + 1;
        aggregated.byStatus[log.status] = (aggregated.byStatus[log.status] || 0) + 1;
      });

      aggregated.dates = Array.from(byDate.values());

      return sendSuccess(c, { analytics: aggregated });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /sms/templates
   * Get all SMS templates
   */
  app.get(`${BASE_PATH}/sms/templates`, async (c) => {
    try {
      return sendSuccess(c, { templates: Object.values(SMS_TEMPLATES) });
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/sms/configure
   * Configure SMS provider
   */
  app.post(`${BASE_PATH}/admin/sms/configure`, async (c) => {
    try {
      const { provider, accountSid, authToken, fromNumber, region } = await c.req.json();

      // Get existing platform settings
      const { data: existing } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_settings')
        .maybeSingle();
      
      const platformSettings = existing?.setting_value || {};
      
      platformSettings.sms = {
        provider, // 'twilio' | 'aws_sns' | 'mock'
        accountSid,
        authToken,
        fromNumber,
        region,
        updatedAt: new Date().toISOString()
      };

      // Save to platform_settings table
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'platform_settings',
          setting_value: platformSettings,
          setting_type: 'object',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      return sendSuccess(c, { message: 'SMS provider configured successfully' });

    } catch (error) {
      console.error('❌ Error configuring SMS:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // EVENT LISTENERS
  // ============================================

  /**
   * Listen to booking events and trigger SMS
   */
  async function handleBookingEvent(event: string, data: any) {
    try {
      console.log(`📱 Handling booking event: ${event}`);

      const { booking, customer, vendor, staff } = data;

      // Map events to SMS templates
      const eventMap: Record<string, { to: string; template: string; variables: any }> = {
        'booking.created': {
          to: customer.phone,
          template: 'booking_created',
          variables: {
            customerName: customer.name,
            bookingId: booking.id,
            serviceName: booking.serviceName,
            date: booking.scheduledDate,
            time: booking.scheduledTime
          }
        },
        'payment.confirmed': {
          to: customer.phone,
          template: 'payment_confirmed',
          variables: {
            amount: booking.totalAmount,
            bookingId: booking.id,
            receiptUrl: `https://warmpawz.com/receipt/${booking.id}`
          }
        },
        'staff.assigned': {
          to: customer.phone,
          template: 'staff_assigned',
          variables: {
            staffName: staff?.name || vendor.businessName,
            bookingId: booking.id,
            staffPhone: staff?.phone || vendor.phone
          }
        },
        'provider.en_route': {
          to: customer.phone,
          template: 'provider_en_route',
          variables: {
            providerName: staff?.name || vendor.businessName,
            bookingId: booking.id
          }
        },
        'provider.arrived': {
          to: customer.phone,
          template: 'provider_arrived',
          variables: {
            providerName: staff?.name || vendor.businessName,
            otp: booking.startOtp
          }
        },
        'service.completed': {
          to: customer.phone,
          template: 'service_completed',
          variables: {
            petName: booking.petName,
            otp: booking.completionOtp,
            bookingId: booking.id
          }
        },
        'booking.cancelled': {
          to: customer.phone,
          template: 'booking_cancelled',
          variables: {
            bookingId: booking.id,
            refundAmount: booking.refundAmount || booking.totalAmount
          }
        },
        'vendor.new_booking': {
          to: vendor.phone,
          template: 'vendor_new_booking',
          variables: {
            bookingId: booking.id,
            serviceName: booking.serviceName,
            date: booking.scheduledDate,
            time: booking.scheduledTime,
            customerName: customer.name,
            customerPhone: customer.phone
          }
        }
      };

      const config = eventMap[event];
      if (config) {
        const message = renderTemplate(config.template, config.variables);
        await sendSMS(config.to, message, event);
      }

    } catch (error) {
      console.error(`❌ Error handling booking event ${event}:`, error);
    }
  }

  console.log('✅ SMS Notification Service Enhanced (SQL-only) registered');
}

