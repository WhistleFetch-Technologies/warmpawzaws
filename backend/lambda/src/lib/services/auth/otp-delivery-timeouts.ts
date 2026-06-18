import { sendSMS } from '../../../utils/sms-service';
import {
  buildLoginOtpSmsBody,
  JIO_DLT_ENTITY_ID,
  JIO_LOGIN_OTP_SENDER_ID,
  JIO_LOGIN_OTP_TEMPLATE_ID,
} from '../../../constants/jio-login-otp-sms';

export type OtpDeliveryFailureReason =
  | 'db_timeout'
  | 'db_exception'
  | 'sms_timeout'
  | 'provider_rejected'
  | 'provider_exception';

export type OtpInsertResult = { ok: true } | { ok: false; reason: OtpDeliveryFailureReason };

export type OtpSmsResult =
  | { ok: true; messageId?: string }
  | { ok: false; reason: OtpDeliveryFailureReason };

export function smsSendTimeoutMs(): number {
  return Math.min(
    30000,
    Math.max(5000, parseInt(process.env.SMS_SEND_TIMEOUT_MS || '15000', 10) || 15000)
  );
}

export async function insertOtpWithTimeout(
  insertFn: () => Promise<void>,
  timeoutMs = 3000
): Promise<OtpInsertResult> {
  try {
    await Promise.race([
      insertFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('db_timeout'), { reason: 'db_timeout' })), timeoutMs)
      ),
    ]);
    return { ok: true };
  } catch (e: any) {
    if (e?.reason === 'db_timeout' || e?.message === 'db_timeout') {
      return { ok: false, reason: 'db_timeout' };
    }
    return { ok: false, reason: 'db_exception' };
  }
}

export async function sendResetOtpSmsWithTimeout(
  dialable: string,
  otpCode: string,
  timeoutMs = smsSendTimeoutMs()
): Promise<OtpSmsResult> {
  const message = buildLoginOtpSmsBody(otpCode);
  try {
    const result = await Promise.race([
      sendSMS({
        to: dialable,
        message,
        type: 'otp',
        templateId: JIO_LOGIN_OTP_TEMPLATE_ID,
        entityId: JIO_DLT_ENTITY_ID,
        senderId: JIO_LOGIN_OTP_SENDER_ID,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(Object.assign(new Error('sms_timeout'), { reason: 'sms_timeout' })),
          timeoutMs
        )
      ),
    ]);
    if (result.success === true) return { ok: true, messageId: result.messageId };
    return { ok: false, reason: 'provider_rejected' };
  } catch (e: any) {
    if (e?.reason === 'sms_timeout' || e?.message === 'sms_timeout') {
      return { ok: false, reason: 'sms_timeout' };
    }
    return { ok: false, reason: 'provider_exception' };
  }
}
