/**
 * ============================================================================
 * SMS SERVICE - AWS SNS SMS INTEGRATION
 * ============================================================================
 * 
 * Provides SMS sending capabilities using AWS SNS:
 * - OTP delivery for order confirmations
 * - Transactional SMS notifications
 * - Delivery status tracking
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'WARMPAWZ';
const SMS_ENABLED = process.env.SMS_ENABLED !== 'false'; // Default to enabled

// SNS Client
const snsClient = new SNSClient({ region: AWS_REGION });

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SMSOptions {
  senderId?: string;
  messageType?: 'Transactional' | 'Promotional';
  maxPrice?: string; // Maximum price in USD (e.g., "0.05")
}

export interface SMSResult {
  messageId: string;
  phoneNumber: string;
  status: 'success' | 'failed';
  error?: string;
}

// ============================================================================
// SMS TEMPLATES
// ============================================================================

const SMS_TEMPLATES = {
  delivery_otp: (otp: string, orderId?: string) => 
    `Your Warmpawz order OTP is ${otp}. Share this with the delivery partner.${orderId ? ` Order: ${orderId.substring(0, 8)}` : ''}`,
  
  order_confirmed: (orderId: string) => 
    `Your Warmpawz order ${orderId.substring(0, 8)} is confirmed. Track your order in the app.`,
  
  order_dispatched: (orderId: string, eta?: string) => 
    `Your order ${orderId.substring(0, 8)} is on the way!${eta ? ` Expected delivery: ${eta}` : ''} Track live in the app.`,
  
  order_delivered: (orderId: string) => 
    `Your order ${orderId.substring(0, 8)} has been delivered. Thank you for using Warmpawz!`,
  
  payment_successful: (orderId: string, amount: number) => 
    `Payment of ₹${amount} successful for order ${orderId.substring(0, 8)}. Your order is being processed.`,
  
  pharmacy_accepted: (orderId: string, pharmacyName: string) => 
    `${pharmacyName} has accepted your order ${orderId.substring(0, 8)}. Preparing now...`,
  
  pharmacy_rejected: (orderId: string) => 
    `Your order ${orderId.substring(0, 8)} was not accepted. We're searching for another pharmacy...`,
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Send SMS using AWS SNS
 */
export async function sendSMS(
  phoneNumber: string,
  message: string,
  options?: SMSOptions
): Promise<SMSResult> {
  // Validate phone number format (Indian format: +91XXXXXXXXXX)
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  if (!normalizedPhone) {
    return {
      messageId: '',
      phoneNumber,
      status: 'failed',
      error: 'Invalid phone number format',
    };
  }

  // Check if SMS is enabled
  if (!SMS_ENABLED) {
    console.log(`[SMS Mock] Would send to ${normalizedPhone}: ${message}`);
    return {
      messageId: `mock-${Date.now()}`,
      phoneNumber: normalizedPhone,
      status: 'success',
    };
  }

  try {
    const command = new PublishCommand({
      PhoneNumber: normalizedPhone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: options?.senderId || SMS_SENDER_ID,
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: options?.messageType || 'Transactional',
        },
        ...(options?.maxPrice ? {
          'AWS.SNS.SMS.MaxPrice': {
            DataType: 'String',
            StringValue: options.maxPrice,
          },
        } : {}),
      },
    });

    const response = await snsClient.send(command);
    
    console.log(`✅ SMS sent to ${normalizedPhone}: ${response.MessageId}`);
    
    return {
      messageId: response.MessageId || '',
      phoneNumber: normalizedPhone,
      status: 'success',
    };
  } catch (error: any) {
    console.error(`❌ Failed to send SMS to ${normalizedPhone}:`, error);
    
    return {
      messageId: '',
      phoneNumber: normalizedPhone,
      status: 'failed',
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Send OTP via SMS
 */
export async function sendOTP(
  phoneNumber: string,
  otp: string,
  orderId?: string,
  orderType: 'pharmacy' | 'booking' | 'general' = 'general'
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.delivery_otp(otp, orderId);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
    senderId: SMS_SENDER_ID,
  });
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmation(
  phoneNumber: string,
  orderId: string
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.order_confirmed(orderId);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
  });
}

/**
 * Send order dispatched SMS
 */
export async function sendOrderDispatched(
  phoneNumber: string,
  orderId: string,
  eta?: string
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.order_dispatched(orderId, eta);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
  });
}

/**
 * Send order delivered SMS
 */
export async function sendOrderDelivered(
  phoneNumber: string,
  orderId: string
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.order_delivered(orderId);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
  });
}

/**
 * Send payment success SMS
 */
export async function sendPaymentSuccess(
  phoneNumber: string,
  orderId: string,
  amount: number
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.payment_successful(orderId, amount);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
  });
}

/**
 * Send pharmacy accepted SMS
 */
export async function sendPharmacyAccepted(
  phoneNumber: string,
  orderId: string,
  pharmacyName: string
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.pharmacy_accepted(orderId, pharmacyName);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
  });
}

/**
 * Send pharmacy rejected SMS
 */
export async function sendPharmacyRejected(
  phoneNumber: string,
  orderId: string
): Promise<SMSResult> {
  const message = SMS_TEMPLATES.pharmacy_rejected(orderId);
  return sendSMS(phoneNumber, message, {
    messageType: 'Transactional',
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize phone number to E.164 format
 * Supports: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle Indian numbers
  if (digits.length === 10) {
    // 10-digit number, add +91
    return `+91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // 11-digit starting with 0, remove 0 and add +91
    return `+91${digits.substring(1)}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // 12-digit starting with 91, add +
    return `+${digits}`;
  } else if (digits.length === 13 && digits.startsWith('91')) {
    // Already in correct format
    return `+${digits}`;
  } else if (phone.startsWith('+')) {
    // Already in E.164 format
    return phone;
  }
  
  // Invalid format
  console.warn(`Invalid phone number format: ${phone}`);
  return null;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  return normalizePhoneNumber(phone) !== null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const smsService = {
  sendSMS,
  sendOTP,
  sendOrderConfirmation,
  sendOrderDispatched,
  sendOrderDelivered,
  sendPaymentSuccess,
  sendPharmacyAccepted,
  sendPharmacyRejected,
  isValidPhoneNumber,
};
