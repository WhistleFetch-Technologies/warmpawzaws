/**
 * Jio DLT — Login OTP template (must match approved text in Jio portal).
 * @see config/sms-templates-jio.json → otp_login
 */

export const JIO_DLT_ENTITY_ID =
  process.env.SMS_ENTITY_ID || process.env.SNS_SMS_ENTITY_ID || '1201176605406673276';

export const JIO_LOGIN_OTP_SENDER_ID =
  process.env.SMS_SENDER_ID || process.env.SNS_SMS_SENDER_ID || 'WARMPZ';

export const JIO_LOGIN_OTP_TEMPLATE_ID =
  process.env.JIO_LOGIN_OTP_TEMPLATE_ID ||
  process.env.SMS_OTP_TEMPLATE_ID ||
  '1207177028377787269';

/** Body must match registered template (only OTP digit span varies). */
export function buildLoginOtpSmsBody(otpCode: string): string {
  return `Warmpawz: Your OTP for logging in is ${otpCode}. Do not share this OTP with anyone.`;
}
