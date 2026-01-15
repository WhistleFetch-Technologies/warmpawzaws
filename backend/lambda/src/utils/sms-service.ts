/**
 * SMS Service Stub
 * 
 * Placeholder for SMS functionality. In production, this would integrate
 * with an SMS provider like Twilio, AWS SNS, or MSG91.
 */

export interface SMSOptions {
  to: string;
  message: string;
  type?: 'otp' | 'transactional' | 'promotional';
}

/**
 * Send SMS - Currently a stub implementation
 * TODO: Integrate with actual SMS provider in production
 */
export async function sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string }> {
  const { to, message, type = 'transactional' } = options;
  
  // Log the SMS that would be sent (for development/debugging)
  console.log(`[SMS-STUB] Would send ${type} SMS to ${to}: ${message}`);
  
  // In production, implement actual SMS sending here
  // Example with Twilio:
  // const twilio = require('twilio')(accountSid, authToken);
  // const result = await twilio.messages.create({ to, body: message, from: fromNumber });
  
  // Return success for now (stub)
  return {
    success: true,
    messageId: `stub-${Date.now()}`,
  };
}

/**
 * Send OTP SMS
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean }> {
  return sendSMS({
    to: phone,
    message: `Your Warmpawz verification OTP is ${otp}. Valid for 10 minutes.`,
    type: 'otp',
  });
}

export default { sendSMS, sendOTP };
