import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';

/**
 * SMS EVENT NOTIFICATIONS SERVICE
 * 
 * Sends SMS notifications for important events using configured Twilio credentials
 * - Booking lifecycle events
 * - Payment confirmations
 * - Refund notifications
 * - Settlement alerts
 * - Service reminders
 */

export function registerSmsEventNotifications(app: Hono) {
  
  // SMS Templates
  const SMS_TEMPLATES = {
    // Booking Events
    booking_confirmed: 'Warmpawz: Your {serviceType} booking for {date} at {time} is confirmed! Booking ID: {bookingId}. Service Partner: {vendorName}',
    
    booking_confirmed_with_otp: 'Warmpawz: Booking confirmed for {date}! Your OTP to start service: {startOtp}. Share with service provider.',
    
    booking_cancelled: 'Warmpawz: Your booking #{bookingId} has been cancelled. {refundMessage}',
    
    booking_rescheduled: 'Warmpawz: Your booking has been rescheduled to {newDate} at {newTime}. Booking ID: {bookingId}',
    
    booking_declined: 'Warmpawz: Your booking request was declined by {vendorName}. Reason: {reason}. Full refund of ₹{amount} will be processed.',
    
    booking_reminder: 'Warmpawz: Reminder! Your {serviceType} appointment is tomorrow at {time}. Booking ID: {bookingId}',
    
    // Service Events
    service_started: 'Warmpawz: Your service has started! End service OTP: {endOtp}. Share with provider when done.',
    
    service_completed: 'Warmpawz: Service completed! Please rate your experience. Booking ID: {bookingId}',
    
    // Payment Events
    payment_success: 'Warmpawz: Payment of ₹{amount} received successfully! Booking ID: {bookingId}. Thank you!',
    
    payment_failed: 'Warmpawz: Payment of ₹{amount} failed. Please retry or contact support. Booking ID: {bookingId}',
    
    // Refund Events
    refund_initiated: 'Warmpawz: Refund of ₹{amount} has been initiated for booking #{bookingId}. It will be credited within 5-7 business days.',
    
    refund_processed: 'Warmpawz: Refund of ₹{amount} has been processed successfully! Check your account.',
    
    // Vendor Events
    new_booking_request: 'Warmpawz: New booking request for {serviceType} on {date}! Login to accept/decline.',
    
    settlement_processed: 'Warmpawz: Settlement of ₹{amount} has been initiated to your bank account. Expected in 2-3 business days.',
    
    vendor_approved: 'Warmpawz: Congratulations! Your vendor account has been approved. Start receiving bookings now!',
    
    // Order Events  
    order_shipped: 'Warmpawz: Your order #{orderId} has been shipped! Track: {trackingUrl}',
    
    order_delivered: 'Warmpawz: Your order #{orderId} has been delivered! Hope your pet loves it!',
    
    // OTP Events
    otp_verification: 'Warmpawz: Your verification code is {otp}. Valid for 5 minutes. Do not share with anyone.',
  };

  /**
   * Send SMS for any event
   */
  async function sendEventSMS(
    event: string,
    phone: string,
    data: Record<string, any>
  ): Promise<boolean> {
    try {
      // Get SMS settings
      const smsSettings = await kv.get('admin:settings:sms') || {};
      
      // Check if SMS is configured
      if (!smsSettings.provider || smsSettings.provider === 'mock') {
        console.log(`📱 [SMS-MOCK] ${event} → ${phone}: ${JSON.stringify(data)}`);
        return true;
      }

      // Get template
      const template = SMS_TEMPLATES[event as keyof typeof SMS_TEMPLATES];
      if (!template) {
        console.error(`[SMS] Template not found for event: ${event}`);
        return false;
      }

      // Format message
      const message = formatTemplate(template, data);

      // Send SMS
      if (smsSettings.provider === 'twilio') {
        return await sendViaTwilio(phone, message, smsSettings.twilio);
      } else if (smsSettings.provider === 'sns') {
        return await sendViaSNS(phone, message, smsSettings.sns);
      }

      return false;

    } catch (error) {
      console.error('[SMS] Event notification error:', error);
      return false;
    }
  }

  /**
   * Format template with data
   */
  function formatTemplate(template: string, data: Record<string, any>): string {
    let message = template;
    
    for (const [key, value] of Object.entries(data)) {
      message = message.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    
    return message;
  }

  /**
   * Send via Twilio
   */
  async function sendViaTwilio(
    phone: string,
    message: string,
    twilioConfig: any
  ): Promise<boolean> {
    try {
      const { accountSid, authToken, fromNumber } = twilioConfig;
      
      if (!accountSid || !authToken || !fromNumber) {
        console.error('[TWILIO] Missing credentials');
        return false;
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
            To: phone,
            From: fromNumber,
            Body: message
          }).toString()
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [TWILIO] SMS sent to ${phone}: SID ${result.sid}`);
        return true;
      } else {
        const error = await response.text();
        console.error('[TWILIO] Error:', error);
        return false;
      }
    } catch (error) {
      console.error('[TWILIO] Exception:', error);
      return false;
    }
  }

  /**
   * Send via AWS SNS
   */
  async function sendViaSNS(
    phone: string,
    message: string,
    snsConfig: any
  ): Promise<boolean> {
    try {
      // AWS SNS implementation
      console.log('[SNS] Implementation pending');
      return true;
    } catch (error) {
      console.error('[SNS] Error:', error);
      return false;
    }
  }

  /**
   * Public trigger functions for each event
   */
  
  // Export for use in other modules
  return {
    sendBookingConfirmed: async (booking: any) => {
      const data = {
        serviceType: booking.serviceName || booking.category,
        date: new Date(booking.scheduledDate).toLocaleDateString(),
        time: booking.scheduledTime,
        bookingId: booking.id,
        vendorName: booking.vendorName,
        startOtp: booking.startOtp || ''
      };
      
      await sendEventSMS('booking_confirmed', booking.customerPhone, data);
      
      // Also notify vendor
      await sendEventSMS(
        'new_booking_request',
        booking.vendorPhone,
        {
          serviceType: booking.serviceName,
          date: new Date(booking.scheduledDate).toLocaleDateString()
        }
      );
    },

    sendBookingCancelled: async (booking: any) => {
      const refundMessage = booking.refund?.eligible 
        ? `Refund of ₹${booking.refund.amount} will be processed.`
        : 'No refund applicable.';
      
      await sendEventSMS('booking_cancelled', booking.customerPhone, {
        bookingId: booking.id,
        refundMessage
      });
    },

    sendBookingRescheduled: async (booking: any) => {
      await sendEventSMS('booking_rescheduled', booking.customerPhone, {
        newDate: new Date(booking.scheduledDate).toLocaleDateString(),
        newTime: booking.scheduledTime,
        bookingId: booking.id
      });
    },

    sendBookingDeclined: async (booking: any) => {
      await sendEventSMS('booking_declined', booking.customerPhone, {
        vendorName: booking.vendorName,
        reason: booking.declineReason || 'Not available',
        amount: booking.totalAmount || booking.price,
        bookingId: booking.id
      });
    },

    sendPaymentSuccess: async (payment: any) => {
      await sendEventSMS('payment_success', payment.customerPhone, {
        amount: payment.amount,
        bookingId: payment.bookingId
      });
    },

    sendRefundInitiated: async (refund: any) => {
      await sendEventSMS('refund_initiated', refund.customerPhone, {
        amount: refund.amount,
        bookingId: refund.bookingId
      });
    },

    sendRefundProcessed: async (refund: any) => {
      await sendEventSMS('refund_processed', refund.customerPhone, {
        amount: refund.amount
      });
    },

    sendServiceStarted: async (booking: any) => {
      await sendEventSMS('service_started', booking.customerPhone, {
        endOtp: booking.endOtp
      });
    },

    sendServiceCompleted: async (booking: any) => {
      await sendEventSMS('service_completed', booking.customerPhone, {
        bookingId: booking.id
      });
    },

    sendSettlementProcessed: async (settlement: any, vendor: any) => {
      await sendEventSMS('settlement_processed', vendor.phone, {
        amount: settlement.amount
      });
    },

    sendOrderShipped: async (order: any) => {
      await sendEventSMS('order_shipped', order.customerPhone, {
        orderId: order.id,
        trackingUrl: order.trackingUrl || 'Check app for tracking'
      });
    },

    sendOrderDelivered: async (order: any) => {
      await sendEventSMS('order_delivered', order.customerPhone, {
        orderId: order.id
      });
    },

    sendBookingReminder: async (booking: any) => {
      await sendEventSMS('booking_reminder', booking.customerPhone, {
        serviceType: booking.serviceName,
        time: booking.scheduledTime,
        bookingId: booking.id
      });
    },

    sendVendorApproved: async (vendor: any) => {
      await sendEventSMS('vendor_approved', vendor.phone, {});
    }
  };
}

// Export type for use in other modules
export type SmsNotificationService = ReturnType<typeof registerSmsEventNotifications>;
