/**
 * ============================================================================
 * SEND OTP CONTROLLER
 * ============================================================================
 * 
 * Handles OTP generation and sending for authentication
 * 
 * Extracted from: endpoints/auth-enhanced.ts
 * Date: 2026-01-28
 * Phase 1: Auth domain restructuring
 * ============================================================================
 */

import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../handler/base-handler-enhanced';
import { sendSMS } from '../../utils/sms-service';
import { insert } from '../../database/rds-connection';
import { SendOtpRequestSchema } from '@warmpawz/api-contracts/auth';

const JIO_LOGIN_OTP_TEMPLATE_ID = '1207177028377787269';

/**
 * Normalize phone to canonical form for OTP storage/lookup
 */
function normalizePhoneForOtp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }
  return digits || phone;
}

async function createOtp(phone: string, code: string, purpose: string = 'login'): Promise<void> {
  const canonicalPhone = normalizePhoneForOtp(phone);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  await insert('otp_tokens', {
    phone: canonicalPhone,
    code,
    purpose,
    expires_at: expiresAt,
    is_used: false,
  });
}

async function sendSmsViaSns(phone: string, message: string): Promise<boolean> {
  const result = await sendSMS({
    to: phone,
    message,
    type: 'otp',
    templateId: JIO_LOGIN_OTP_TEMPLATE_ID,
    senderId: 'WARMPZ',
  });
  if (!result.success) {
    console.error('[SMS] SNS send failed');
  }
  return result.success === true;
}

export class SendOtpHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    
    const validationResult = SendOtpRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        context.requestId
      );
    }

    const { phone } = validationResult.data;
    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    const handlerStartTime = Date.now();
    
    try {
      const isUATMode = process.env.UAT_MODE === 'true';
      const otpCode = isUATMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
      
      if (isUATMode) {
        console.log(`[AUTH] UAT Mode: Using fixed OTP 123456 for ${phone}`);
      } else {
        console.log(`[AUTH] Production Mode: Generated random OTP for ${phone}`);
      }
      
      const otpStoreStartTime = Date.now();
      try {
        const createOtpPromise = createOtp(phone, otpCode, body.role || 'login');
        const otpTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('OTP storage timeout after 3 seconds')), 3000);
        });
        await Promise.race([createOtpPromise, otpTimeoutPromise]);
        const otpStoreDuration = Date.now() - otpStoreStartTime;
        console.log(`[AUTH] OTP stored in ${otpStoreDuration}ms`);
      } catch (dbError: any) {
        const otpStoreDuration = Date.now() - otpStoreStartTime;
        console.error(`[AUTH] Database error creating OTP after ${otpStoreDuration}ms:`, dbError?.message || dbError);
        if (!isUATMode) {
          throw dbError;
        }
        console.warn('[AUTH] UAT Mode: Continuing despite database error - OTP will still work');
      }

      if (!isUATMode) {
        const message = `Warmpawz: Your OTP for logging in is ${otpCode}. Do not share this OTP with anyone.`;
        console.log(`[AUTH] Sending OTP SMS to ${normalizedPhone} (templateId=${JIO_LOGIN_OTP_TEMPLATE_ID})`);
        const smsResult = await Promise.race([
          sendSmsViaSns(normalizedPhone, message),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('SMS send timeout 2.5s')), 2500)),
        ]).catch((err: any) => {
          console.warn('[AUTH] SMS send failed:', err?.message || err);
          if (err?.Code) console.warn('[AUTH] SNS Code:', err.Code);
          return false;
        });
        if (smsResult) {
          console.log('[AUTH] SMS accepted by SNS (delivery depends on SNS sandbox/production)');
        }
      } else {
        console.log(`[AUTH] UAT_MODE=true: SMS skipped for ${phone} (fixed OTP 123456)`);
      }

      const handlerDuration = Date.now() - handlerStartTime;
      console.log(`[AUTH] Send OTP handler completed in ${handlerDuration}ms`);

      return this.success({
        success: true,
        data: {
          message: 'OTP sent successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: context.requestId,
          version: 'v1',
        },
      }, context.requestId);

    } catch (error: any) {
      console.error('[AUTH] Error sending OTP:', error);
      console.error('[AUTH] Error stack:', error.stack);
      return this.error(
        'Failed to send OTP',
        500,
        'INTERNAL_ERROR',
        { 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        context.requestId
      );
    }
  }
}
