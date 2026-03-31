/**
 * ============================================================================
 * AUTHENTICATION ENDPOINTS - ENHANCED VERSION
 * ============================================================================
 * 
 * Enhanced with:
 * - BaseHandlerEnhanced for CloudWatch logging
 * - API contracts for validation
 * - Standardized responses
 * - Request ID tracking
 * 
 * Date: 2026-01-28
 * Phase 2: Enhanced handler migration
 * ============================================================================
 */

import { Hono } from 'hono';
import { sendSMS } from '../../utils/sms-service';
import { query, select, insert, update } from '../../database/rds-connection';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../handler/base-handler-enhanced';
import {
  getOrCreateCognitoUser,
  authenticateCognitoUser,
  verifyCognitoToken,
  CognitoTokens
} from '../../utils/cognito-client';

import {
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
} from '@warmpawz/api-contracts/auth';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../utils/entity-extractor';
import { isValidUUID } from '../../types/entities';
import { createOrUpdateCustomerIdentity, getCustomerStateForAuth } from '../../utils/customer-state';
import { generateUATJWTToken } from '../../utils/jwt-generator';
import { loyaltyRulesInitService } from 'src/lib/services/loyalty-rules-init-service';
import { processReferralSignup, processVendorReferralForCustomerSignup } from 'src/lib/services/referral-service';

// ============================================================================
// OTP HELPERS
// ============================================================================

const JIO_LOGIN_OTP_TEMPLATE_ID = '1207177028377787269';

/**
 * Normalize phone to canonical form for OTP storage/lookup.
 * Ensures "9326977987", "+919326977987", "919326977987" all match.
 * Indian 10-digit numbers: use last 10 digits. Others: digits only.
 */
function normalizePhoneForOtp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10; // Indian mobile
  }
  return digits || phone;
}

/** Collapse +91 and 10-digit customer rows to one canonical record. */
async function selectCustomersByLast10Digits(last10: string): Promise<any[]> {
  const key = last10.replace(/\D/g, '').slice(-10);
  if (!key || key.length < 10) return [];
  const res = await query(
    `SELECT * FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY
       LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) ASC,
       (profile_completed IS TRUE) DESC,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST`,
    [key]
  );
  return (res as any).rows || [];
}

/** Persist Indian mobiles as 10 digits in `customers.phone` (same as profile POST). */
function storagePhoneForNewCustomer(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }
  return phone;
}

async function applyCustomerReferralOnAuth(
  userId: string,
  phone: string,
  referralCodeRaw: string | undefined
): Promise<void> {
  if (!referralCodeRaw || !userId || userId.startsWith('temp_')) return;

  const normalizedCode = String(referralCodeRaw).trim().toUpperCase();
  const referralResult = await processReferralSignup({
    customerId: userId,
    referralCode: normalizedCode,
    phone,
  });

  if (referralResult.success) return;
  if (referralResult.error !== 'Invalid referral code') {
    console.warn(`[AUTH] Referral not applied: ${referralResult.error}`);
    return;
  }

  const vendorRes = await processVendorReferralForCustomerSignup({
    customerId: userId,
    phone,
    referralCode: normalizedCode,
  });
  if (!vendorRes.success) {
    console.warn(`[AUTH] Vendor referral fallback failed: ${vendorRes.error}`);
  }
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

async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const canonicalPhone = normalizePhoneForOtp(phone);
  // Try canonical first, then original (for backward compatibility with existing tokens)
  const phonesToTry = [canonicalPhone];
  const alt = phone.replace(/\D/g, '').slice(-10);
  if (alt && alt !== canonicalPhone) phonesToTry.push(alt);
  if (phone !== canonicalPhone && phone !== alt) phonesToTry.push(phone);

  for (const p of phonesToTry) {
    const records = await select('otp_tokens', {
      phone: p,
      code,
      is_used: false,
    });

    if (records.length === 0) continue;

    const record = records[0];
    if (new Date(record.expires_at) < new Date()) return false;

    await query(
      'UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1',
      [record.id]
    );
    return true;
  }
  return false;
}

/**
 * Send SMS via SNS (DLT-aware)
 */
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

// ============================================================================
// ENHANCED HANDLERS
// ============================================================================

class SendOtpHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);

    // Validate request with Zod schema
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

    // Normalize phone number (add + if missing and starts with country code)
    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    const handlerStartTime = Date.now();

    try {
      // Generate OTP - use 123456 in UAT mode, random 6-digit in production
      // Check multiple ways to detect dev/UAT environment
      const isUATMode = process.env.UAT_MODE === 'true';

      const otpCode = isUATMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

      if (isUATMode) {
        console.log(`[AUTH] UAT Mode: Using fixed OTP 123456 for ${phone}`);
      } else {
        console.log(`[AUTH] Production Mode: Generated random OTP for ${phone}`);
      }

      // ✅ FIX: Store OTP with timeout protection (3 seconds max)
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
        // In UAT environments, continue even if database fails (for testing)
        if (!isUATMode) {
          throw dbError;
        }
        console.warn('[AUTH] UAT Mode: Continuing despite database error - OTP will still work');
      }

      // Only skip SMS when UAT_MODE is explicitly 'true'. Use Jio-approved Login OTP template.
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

      // Return standardized response immediately (don't wait for SMS)
      return this.success({
        success: true,
        data: {
          message: 'OTP sent successfully',
          // Don't send OTP in response for security
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

class VerifyOtpHandlerEnhanced extends BaseHandlerEnhanced {

  /**
   * Helper function to check if a record is soft-deleted
   * Handles boolean true, string "true", PostgreSQL 't'/'f', and case variations
   */
  private isRecordDeleted(record: any): boolean {
    if (!record || record.is_deleted === undefined || record.is_deleted === null) {
      return false;
    }
    // Handle boolean true
    if (record.is_deleted === true) return true;
    // Handle PostgreSQL boolean 't' (true) or 'f' (false)
    if (record.is_deleted === 't') return true;
    if (record.is_deleted === 'f') return false;
    // Handle string "true" (case-insensitive)
    if (typeof record.is_deleted === 'string' && record.is_deleted.toLowerCase() === 'true') return true;
    // Handle numeric 1 (some databases return 1 for true)
    if (record.is_deleted === 1) return true;
    return false;
  }

  async handle(context: HandlerContext): Promise<HandlerResponse> {
    console.log(`[AUTH] 📝 VerifyOtpHandlerEnhanced handle called`);
    const body = this.parseBody(context.event);

    // Validate request with Zod schema
    const validationResult = VerifyOtpRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        context.requestId
      );
    }

    const { phone, otp } = validationResult.data;
    console.log(`[AUTH] 📝 Phone: ${phone}, OTP: ${otp}`);
    //Referral code extraction 
    // Extract referralCode from body (optional, not in schema)
    // Try multiple possible locations in the request
    // Also try parsing from raw event body if needed
    // CRITICAL FIX: Also check the parsed body from parseBody method
    // Enhanced logging for referral code
    let referralCode = (body as any)?.referralCode
      || (body as any)?.pendingReferralCode
      || undefined;

    if (!referralCode && context.event?.body) {
      try {
        const rawBody = typeof context.event.body === 'string'
          ? JSON.parse(context.event.body)
          : context.event.body;
        referralCode = rawBody?.referralCode || rawBody?.pendingReferralCode || undefined;
      } catch (e) {
        // Ignore parse errors
      }
    }
    if (!referralCode) {
      try {
        const parsedBody = this.parseBody(context.event);
        referralCode = (parsedBody as any)?.referralCode
          || (parsedBody as any)?.pendingReferralCode
          || undefined;
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (referralCode) {
      console.log(`[AUTH] ✅ Referral code found: ${referralCode}`);
    } else {
      console.log(`[AUTH] ⚠️ No referral code found in request`);
      if (body) {
        console.log(`[AUTH] 📝 Full body: ${JSON.stringify(body).substring(0, 500)}`);
        // Check all possible referral code fields
        console.log(`[AUTH] 📝 body.referralCode: ${(body as any)?.referralCode || 'NOT FOUND'}`);
        console.log(`[AUTH] 📝 body.pendingReferralCode: ${(body as any)?.pendingReferralCode || 'NOT FOUND'}`);
      }
      if (context.event?.body) {
        const bodyStr = typeof context.event.body === 'string' ? context.event.body : JSON.stringify(context.event.body);
        console.log(`[AUTH] 📝 Event body (first 500 chars): ${bodyStr.substring(0, 500)}`);
        // Try to parse and check
        try {
          const parsed = typeof context.event.body === 'string' ? JSON.parse(context.event.body) : context.event.body;
          console.log(`[AUTH] 📝 Parsed event body keys: ${Object.keys(parsed).join(', ')}`);
          console.log(`[AUTH] 📝 Parsed event body.referralCode: ${parsed?.referralCode || 'NOT FOUND'}`);
          console.log(`[AUTH] 📝 Parsed event body.pendingReferralCode: ${parsed?.pendingReferralCode || 'NOT FOUND'}`);
        } catch (e) {
          console.log(`[AUTH] 📝 Could not parse event body for referral code check`);
        }
      }
    }

    // ============================================================================
    // OTP VERIFICATION LOGIC
    // ============================================================================
    // Check if UAT mode is enabled - ONLY check UAT_MODE env variable
    // This ensures PROD (UAT_MODE=false) never accepts fixed OTP 123456
    const isUATMode = process.env.UAT_MODE === 'true';

    // Production bypass configuration (for testing/admin access in production)
    // In production mode, ANY phone number can verify with OTP 000000 (6 zeros)
    const PRODUCTION_BYPASS_OTP = '000000';

    try {
      let isValid = false;

      // Normalize phone number for bypass check (extract last 10 digits)
      const phoneDigits = phone.replace(/\D/g, '');
      const normalizedPhone = phoneDigits.length > 10
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9
          ? '0' + phoneDigits
          : phoneDigits;

      // ============================================================================
      // PRODUCTION BYPASS: Allow ANY phone number with OTP 000000 in production only
      // ============================================================================
      // This bypass works ONLY in production mode (when UAT_MODE !== 'true')
      // It allows ANY phone number to verify with OTP 000000 for testing/admin purposes
      if (!isUATMode && otp === PRODUCTION_BYPASS_OTP) {
        isValid = true;
        console.log(`[AUTH] Production Bypass: OTP 000000 accepted for phone ${phone} (normalized: ${normalizedPhone})`);

        // Try to mark any existing OTP tokens as used (non-blocking, with timeout)
        Promise.race([
          (async () => {
            try {
              const records = await select('otp_tokens', {
                phone: normalizedPhone,
                is_used: false,
              });
              if (records.length > 0) {
                await query(
                  'UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1',
                  [records[0].id]
                );
                console.log(`[AUTH] Production Bypass: Marked existing OTP as used`);
              }
            } catch (e) {
              console.warn('[AUTH] Production Bypass: Could not mark existing OTP as used:', e);
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 2000)) // 2 second timeout
        ]).catch((e) => {
          console.warn('[AUTH] Production Bypass: OTP cleanup timeout or error:', e);
        });
      }
      // ============================================================================
      // UAT MODE: Allow fixed OTP 123456 for any phone number in UAT mode
      // ============================================================================
      else if (isUATMode && otp === '123456') {
        isValid = true;
        console.log(`[AUTH] UAT Mode: Fixed OTP 123456 accepted for ${phone}`);
        Promise.race([
          (async () => {
            try {
              const records = await select('otp_tokens', {
                phone,
                is_used: false,
              });
              if (records.length > 0) {
                await query(
                  'UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1',
                  [records[0].id]
                );
              }
            } catch (e) {
              console.warn('[AUTH] UAT Mode: Could not mark existing OTP as used:', e);
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 2000)) // 2 second timeout
        ]).catch((e) => {
          console.warn('[AUTH] UAT Mode: OTP cleanup timeout or error:', e);
        });
      }
      // ============================================================================
      // PRODUCTION MODE: Standard OTP verification from database
      // ============================================================================
      else {

        const OTP_VERIFY_TIMEOUT_MS = 10000;
        try {
          const verifyOtpPromise = verifyOtp(phone, otp);
          const verifyOtpTimeout = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('OTP verification timeout after 10 seconds')), OTP_VERIFY_TIMEOUT_MS)
          );

          isValid = await Promise.race([verifyOtpPromise, verifyOtpTimeout]);

          if (isValid) {
            console.log(`[AUTH] Production Mode: OTP verified successfully for ${phone}`);
          } else {
            console.log(`[AUTH] Production Mode: OTP verification failed for ${phone}`);
          }
        } catch (verifyError: any) {
          console.error(`[AUTH] Production Mode: OTP verification error for ${phone}:`, verifyError?.message || verifyError);

          // If it's a timeout, return 503 Service Unavailable
          if (verifyError?.message?.includes('timeout')) {
            return this.error(
              'Service temporarily unavailable. Please try again.',
              503,
              'SERVICE_UNAVAILABLE',
              { details: 'OTP verification timeout' },
              context.requestId
            );
          }

          // For other database errors, return 500 but don't fail the request
          // This allows the user to retry
          console.warn(`[AUTH] Production Mode: Database error during OTP verification, treating as invalid OTP`);
          isValid = false;
        }
      }
      if (!isValid) {
        return this.error('Invalid or expired OTP', 401, 'UNAUTHORIZED', undefined, context.requestId);
      }

      // Note: normalizedPhone is already computed above for OTP verification
      // Reuse it for database lookups (already in scope)


      let role = body.role || 'customer';

      let userId: string = '';
      let userData: any = null;

      // ============================================================================
      // REGULAR CUSTOMER/VENDOR LOGIN
      // ============================================================================
      if (role === 'customer') {
        let customers: any[] = [];
        const last10ForCustomer =
          phoneDigits.length >= 10
            ? phoneDigits.slice(-10)
            : phone.replace(/\D/g, '').slice(-10);

        try {
          const customerQueryPromise = (async () => {
            if (last10ForCustomer.length >= 10) {
              const byDigits = await selectCustomersByLast10Digits(last10ForCustomer);
              if (byDigits.length > 0) return byDigits;
            }
            return select('customers', { phone });
          })();
          const customerQueryTimeout = new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('Customer query timeout')), 5000)
          );
          customers = await Promise.race([customerQueryPromise, customerQueryTimeout]);
        } catch (customerQueryError: any) {
          console.warn('[AUTH] Customer query timed out or failed, treating as new customer:', customerQueryError.message);
          customers = [];
        }

        if (last10ForCustomer.length >= 10) {
          try {
            const canon = await selectCustomersByLast10Digits(last10ForCustomer);
            if (canon.length > 0) customers = canon;
          } catch (canonErr: any) {
            console.warn('[AUTH] Canonical customer collapse failed:', canonErr?.message);
          }
        }

        if (customers.length === 0 && last10ForCustomer.length >= 10) {
          try {
            const again = await selectCustomersByLast10Digits(last10ForCustomer);
            if (again.length > 0) customers = again;
          } catch (raceErr: any) {
            console.warn('[AUTH] Customer recheck before signup failed:', raceErr?.message);
          }
        }

        let isNewCustomer = false;

        if (customers.length > 0) {
          userId = customers[0].id;
          userData = customers[0];

          // Update last_login_at timestamp to persist login state (with timeout)
          try {
            const updatePromise = update('customers', { id: userId }, {
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            const updateTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Update timeout')), 5000)
            );
            await Promise.race([updatePromise, updateTimeout]);
            console.log(`[AUTH] Updated last_login_at for customer ${userId}`);
          } catch (updateError: any) {
            console.warn('[AUTH] Could not update customer last_login_at:', updateError.message);
            // Continue - update is not critical
          }

          // Create/update customer identity if needed (with timeout)
          // const { createOrUpdateCustomerIdentity } = await import('../utils/customer-state');
          let identityId: string | undefined;
          try {

            const identityPromise = createOrUpdateCustomerIdentity(phone, userId);
            const identityTimeout = new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Identity creation timeout')), 5000)
            );
            identityId = await Promise.race([identityPromise, identityTimeout]);
          } catch (identityError: any) {
            console.warn('[AUTH] Could not create/update customer identity:', identityError.message);
            // Continue - identity creation is not critical for login
          }

          // Link identity to customer if not linked (with timeout)
          if (identityId && !userData.customer_identity_id) {
            try {
              const linkPromise = update('customers', { id: userId }, { customer_identity_id: identityId });
              const linkTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Link timeout')), 5000)
              );
              await Promise.race([linkPromise, linkTimeout]);
            } catch (linkError: any) {
              console.warn('[AUTH] Could not link customer identity:', linkError.message);
              // Continue - linking is not critical
            }
          }

          try {
            await applyCustomerReferralOnAuth(userId, normalizedPhone || phone, referralCode);
          } catch (refError: any) {
            console.error('[AUTH] Referral error (existing customer):', refError?.message || refError);
          }
        } else {
          // Create customer with proper state
          isNewCustomer = true;

          // Ensure loyalty_action_rules table and referral_signup rule exist (before creating customer)
          //              const { loyaltyRulesInitService } = await import('../lib/services/loyalty-rules-init-service');

          if (referralCode) {
            try {
              await loyaltyRulesInitService.ensureReferralSignupRule();
            } catch (initError: any) {
              console.warn('[AUTH] Could not initialize loyalty rules:', initError.message);
              // Continue - rule initialization failure shouldn't block signup
            }
          }

          // Create customer identity first (with timeout)
          //const { createOrUpdateCustomerIdentity } = await import('../utils/customer-state');

          const storedPhone = storagePhoneForNewCustomer(phone);
          let identityId: string | undefined;
          try {
            const identityPromise = createOrUpdateCustomerIdentity(storedPhone, undefined);
            const identityTimeout = new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Identity creation timeout')), 5000)
            );
            identityId = await Promise.race([identityPromise, identityTimeout]);
          } catch (identityError: any) {
            console.warn('[AUTH] Could not create customer identity, continuing without it:', identityError.message);
            // Continue without identity - can be created later
          }

          // Create customer with default full_name (will be updated during profile completion) (with timeout)
          let newCustomers: any[] = [];
          try {
            const insertPromise = insert('customers', {
              phone: storedPhone,
              full_name: `Customer ${storedPhone.slice(-4)}`, // Temporary name until profile is completed
              is_active: true,
              status: 'new',
              onboarding_status: 'PHONE_VERIFIED',
              profile_completed: false,
              customer_identity_id: identityId,
              last_login_at: new Date().toISOString(),
            });
            const insertTimeout = new Promise<any[]>((_, reject) =>
              setTimeout(() => reject(new Error('Customer insert timeout')), 5000)
            );
            newCustomers = await Promise.race([insertPromise, insertTimeout]);
            userId = newCustomers[0].id;
            userData = newCustomers[0];
          } catch (insertError: any) {
            console.error('[AUTH] Failed to create customer record:', insertError.message);
            // This is critical - we need a user ID, so generate a temp one
            userId = `temp_customer_${storedPhone}_${Date.now()}`;
            userData = {
              id: userId,
              phone: storedPhone,
              is_active: true,
              status: 'new',
              onboarding_status: 'PHONE_VERIFIED',
              profile_completed: false,
            };
            console.warn('[AUTH] Using temporary customer ID due to insert failure');
          }

          // Link identity to customer (with timeout, non-critical)
          if (identityId && userId && !userId.startsWith('temp_')) {
            try {
              const linkPromise = update('customer_identity', { id: identityId }, { customer_id: userId });
              const linkTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Link timeout')), 5000)
              );
              await Promise.race([linkPromise, linkTimeout]);
            } catch (linkError: any) {
              console.warn('[AUTH] Could not link customer identity:', linkError.message);
              // Continue - linking is not critical
            }
          }

          try {
            await applyCustomerReferralOnAuth(userId, normalizedPhone || phone, referralCode);
          } catch (refError: any) {
            console.error('[AUTH] ❌ Error processing referral code during signup:', refError?.message || refError);
          }

          // Signup loyalty: handled by action_sources → ActionOccurred → loyalty-events-consumer (not inline here).
        }
      } else if (role === 'vendor') {

        let vendorIdentity: any[] = [];
        let vendors: any[] = [];

        try {
          const vendorQueriesPromise = Promise.all([
            select('vendor_identity', { phone }),
            select('vendors', { phone })
          ]);

          const vendorQueriesTimeout = new Promise<[any[], any[]]>((_, reject) =>
            setTimeout(() => reject(new Error('Vendor queries timeout')), 5000)
          );

          [vendorIdentity, vendors] = await Promise.race([
            vendorQueriesPromise,
            vendorQueriesTimeout
          ]);

          // If not found with original phone (e.g. "+912143242342"), retry with normalizedPhone ("2143242342")
          // This handles the mismatch between how the frontend sends phone (+91 prefix) vs how DB stores it
          if (vendors.length === 0 && normalizedPhone !== phone) {
            console.log(`[AUTH] Vendor not found with phone "${phone}", retrying with normalizedPhone "${normalizedPhone}"`);
            const retryVendors = await select('vendors', { phone: normalizedPhone });
            if (retryVendors.length > 0) {
              vendors = retryVendors;
              console.log(`[AUTH] Found ${retryVendors.length} vendor(s) with normalizedPhone, is_deleted: ${retryVendors.map((v: any) => v.is_deleted).join(', ')}`);
            }
          }
          if (vendorIdentity.length === 0 && normalizedPhone !== phone) {
            console.log(`[AUTH] Vendor identity not found with phone "${phone}", retrying with normalizedPhone "${normalizedPhone}"`);
            const retryIdentity = await select('vendor_identity', { phone: normalizedPhone });
            if (retryIdentity.length > 0) {
              vendorIdentity = retryIdentity;
              console.log(`[AUTH] Found ${retryIdentity.length} vendor_identity record(s) with normalizedPhone, is_deleted: ${retryIdentity.map((vi: any) => vi.is_deleted).join(', ')}`);
            }
          }
        } catch (vendorQueryError: any) {
          console.warn('[AUTH] Vendor queries timed out or failed, continuing with minimal data:', vendorQueryError.message);
          // Continue with empty arrays - will create temp vendor ID
          vendorIdentity = [];
          vendors = [];
        }

        // ────────────────────────────────────────────────────────────────────────────
        // FILTER OUT SOFT-DELETED RECORDS
        // If is_deleted = true, treat as if record doesn't exist (allow new registration)
        // Deleted users should be able to create new accounts with the same phone number
        // ────────────────────────────────────────────────────────────────────────────
        const deletedVendor = vendors.find((v: any) => this.isRecordDeleted(v));
        if (deletedVendor) {
          console.log(`[AUTH] Vendor ${deletedVendor.id} is soft-deleted (is_deleted = true) - treating as new user, allowing role selection`);
        }

        const deletedIdentity = vendorIdentity.find((vi: any) => this.isRecordDeleted(vi));
        if (deletedIdentity) {
          console.log(`[AUTH] Vendor identity ${deletedIdentity.id} is soft-deleted (is_deleted = true) - treating as new user, allowing role selection`);
        }

        // ────────────────────────────────────────────────────────────────────────────
        // FILTER OUT SOFT-DELETED RECORDS (defense in depth)
        // ────────────────────────────────────────────────────────────────────────────
        vendors = vendors.filter((v: any) => !this.isRecordDeleted(v));
        vendorIdentity = vendorIdentity.filter((vi: any) => !this.isRecordDeleted(vi));

        if (vendors.length > 0) {
          const vendor = vendors[0];

          // ✅ SECURITY: Block login if vendor is deactivated
          // Check: status = 'suspended' OR 'inactive' AND is_active = false
          if (vendor.is_active === false && (vendor.status === 'suspended' || vendor.status === 'inactive')) {
            console.warn(`[AUTH] ⚠️ Vendor ${vendor.id} is deactivated (is_active: ${vendor.is_active}, status: ${vendor.status}) - blocking login`);
            return this.error('Your vendor account has been deactivated. Please contact support for assistance.', 403, 'VENDOR_DEACTIVATED', undefined, context.requestId);
          }

          userId = vendors[0].id;
          userData = vendors[0];
          // ✅ Merge onboarding_status from vendor_identity if available
          if (vendorIdentity.length > 0) {
            userData.onboarding_status = vendorIdentity[0].onboarding_status;
            userData.vendor_identity_id = vendorIdentity[0].id;
          }
          // Update last_login_at timestamp to persist login state (with timeout)
          try {
            const updatePromise = update('vendors', { id: userId }, {
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            const updateTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Update timeout')), 5000)
            );
            await Promise.race([updatePromise, updateTimeout]);
            console.log(`[AUTH] Updated last_login_at for vendor ${userId}, onboarding_status: ${userData.onboarding_status}`);
          } catch (updateError: any) {
            console.warn('[AUTH] Could not update vendor last_login_at:', updateError.message);
            // Continue - update is not critical
          }
        } else if (vendorIdentity.length > 0) {
          // Vendor record doesn't exist yet, but vendor_identity does (mid-onboarding)
          const identity = vendorIdentity[0];

          // ✅ FIX: Check if vendor_id is set (vendor was approved but vendors lookup failed)
          if (identity.vendor_id) {
            // Try to get vendor by vendor_id (with timeout)
            let vendorsByVendorId: any[] = [];
            try {
              const vendorByIdPromise = select('vendors', { id: identity.vendor_id });
              const vendorByIdTimeout = new Promise<any[]>((_, reject) =>
                setTimeout(() => reject(new Error('Vendor by ID query timeout')), 5000)
              );
              vendorsByVendorId = await Promise.race([vendorByIdPromise, vendorByIdTimeout]);
            } catch (vendorByIdError: any) {
              console.warn('[AUTH] Could not fetch vendor by ID:', vendorByIdError.message);
              vendorsByVendorId = [];
            }
            if (vendorsByVendorId.length > 0) {
              const vendorById = vendorsByVendorId[0];

              // ────────────────────────────────────────────────────────────────────────────
              // CHECK IF VENDOR IS SOFT-DELETED
              // If is_deleted = true, treat as if vendor doesn't exist (allow new registration)
              // ────────────────────────────────────────────────────────────────────────────
              if (this.isRecordDeleted(vendorById)) {
                console.log(`[AUTH] Vendor ${vendorById.id} is soft-deleted (is_deleted = true) - treating as new user, allowing role selection`);
                // Clear array to fall through to new user flow
                vendorsByVendorId = [];
              } else {
                // ✅ SECURITY: Block login if vendor is deactivated (only for non-deleted records)
                // Check: status = 'suspended' OR 'inactive' AND is_active = false
                if (vendorById.is_active === false && (vendorById.status === 'suspended' || vendorById.status === 'inactive')) {
                  console.warn(`[AUTH] ⚠️ Vendor ${vendorById.id} is deactivated (is_active: ${vendorById.is_active}, status: ${vendorById.status}) - blocking login`);
                  return this.error('Your vendor account has been deactivated. Please contact support for assistance.', 403, 'VENDOR_DEACTIVATED', undefined, context.requestId);
                }

                // Use the actual vendor record (not deleted and not deactivated)
                userId = vendorById.id;
                userData = vendorById;
                userData.onboarding_status = identity.onboarding_status;
                userData.vendor_identity_id = identity.id;
                console.log(`[AUTH] Vendor found via vendor_identity.vendor_id: ${userId}, status: ${identity.onboarding_status}`);
              }
            }

            // If vendor was deleted or not found, treat as new user (allow role selection)
            if (vendorsByVendorId.length === 0) {
              // vendor_id points to deleted/non-existent vendor - treat as new user
              console.log(`[AUTH] vendor_identity.vendor_id points to deleted/missing vendor - treating as new user, allowing role selection`);
              // Clear vendorIdentity to fall through to new user flow
              vendorIdentity = [];
            }
          } else {
            // Vendor not approved yet - use identity ID (this is correct for mid-onboarding)
            userId = identity.id;
            userData = {
              id: identity.id,
              phone: phone,
              is_active: false,
              onboarding_status: identity.onboarding_status,
              vendor_identity_id: identity.id,
              created_at: identity.created_at,
            };
            console.log(`[AUTH] Vendor identity found for ${phone} with status: ${userData.onboarding_status} (not approved yet)`);
          }
        } else {
          // Vendor doesn't exist yet - this is OK for new vendor registration
          // OTP verification will succeed and they can proceed to onboarding
          // Generate a temporary user ID for the new vendor
          userId = `temp_vendor_${phone}_${Date.now()}`;
          userData = {
            id: userId,
            phone: phone,
            is_active: false,
            onboarding_status: 'INIT',
            created_at: new Date().toISOString(),
          };
          console.log(`[AUTH] New vendor OTP verified for ${phone} - proceeding to onboarding`);

          // Process vendor referral code if provided (for new vendors only)
          if (referralCode && normalizedPhone) {
            try {
              console.log(`[AUTH] Processing vendor referral code: ${referralCode} for phone: ${normalizedPhone}`);

              // Find or create vendor referral record
              const normalizedCode = referralCode.trim().toUpperCase();
              let referralRecords = await query(
                `SELECT * FROM vendor_referrals 
                 WHERE referral_code = $1 AND referred_phone = $2 
                 ORDER BY created_at DESC LIMIT 1`,
                [normalizedCode, normalizedPhone]
              );

              let referralRecord = referralRecords.rows[0];

              // If no record exists, try to find by code only (referrer might have sent code to this phone)
              if (!referralRecord) {
                const codeRecords = await query(
                  `SELECT * FROM vendor_referrals 
                   WHERE referral_code = $1 
                   ORDER BY created_at DESC LIMIT 1`,
                  [normalizedCode]
                );

                if (codeRecords.rows.length > 0) {
                  // Create new referral record for this phone
                  const newReferral = await insert('vendor_referrals', {
                    referrer_vendor_id: codeRecords.rows[0].referrer_vendor_id,
                    referred_phone: normalizedPhone,
                    referral_code: normalizedCode,
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                  referralRecord = newReferral[0];
                  console.log(`[AUTH] Created new vendor referral record for phone: ${normalizedPhone}`);
                }
              }

              if (referralRecord) {
                // Store referral metadata in vendor_identity metadata (similar to customer flow)
                // We'll process the referral when vendor account is actually created
                console.log(`[AUTH] ✅ Vendor referral record found/created: ${referralRecord.id}`);
                console.log(`[AUTH] Referrer vendor ID: ${referralRecord.referrer_vendor_id}`);

                // Ensure vendor_identity exists so referral metadata is always persisted for later activation flow.
                let identity = vendorIdentity.length > 0 ? vendorIdentity[0] : null;
                if (!identity) {
                  try {
                    const createdIdentity = await insert('vendor_identity', {
                      phone: normalizedPhone,
                      onboarding_status: 'INIT',
                      metadata: {},
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    });
                    if (createdIdentity.length > 0) {
                      identity = createdIdentity[0];
                      vendorIdentity = createdIdentity;
                      console.log(`[AUTH] ✅ Created vendor_identity for referral tracking: ${identity.id}`);
                    }
                  } catch (createIdentityError: any) {
                    console.warn(`[AUTH] Could not create vendor_identity for referral metadata: ${createIdentityError.message}`);
                    // Race-safe fallback: identity might have been created by another request.
                    try {
                      const reloadedIdentity = await select('vendor_identity', { phone: normalizedPhone });
                      if (reloadedIdentity.length > 0) {
                        identity = reloadedIdentity[0];
                        vendorIdentity = reloadedIdentity;
                      }
                    } catch (reloadError: any) {
                      console.warn(`[AUTH] Could not reload vendor_identity after create failure: ${reloadError.message}`);
                    }
                  }
                }

                if (identity) {
                  const metadata = identity.metadata || {};
                  metadata.referral_code_id = referralRecord.id;
                  metadata.referrer_vendor_id = referralRecord.referrer_vendor_id;
                  metadata.referral_code = normalizedCode;

                  try {
                    await update('vendor_identity', { id: identity.id }, {
                      metadata: metadata,
                      updated_at: new Date().toISOString(),
                    });
                    console.log(`[AUTH] ✅ Stored vendor referral metadata in vendor_identity`);
                  } catch (metaError: any) {
                    console.error(`[AUTH] Error storing referral metadata: ${metaError.message}`);
                  }
                } else {
                  console.warn('[AUTH] ⚠️ Referral record exists but vendor_identity is unavailable; metadata not persisted');
                }
              } else {
                console.log(`[AUTH] ⚠️ No vendor referral record found for code: ${normalizedCode}`);
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ Error processing vendor referral code:', refError.message);
              console.error('[AUTH] Error stack:', refError.stack);
              // Don't fail vendor signup if referral processing fails
            }
          }
        }
      } else if (role === 'admin') {
        // Admin login via OTP (alternative to email/password)
        try {
          const admins = await select('admins', { phone });
          if (admins.length > 0) {
            userId = admins[0].id;
            userData = admins[0];
            // Update last_login_at timestamp to persist login state
            try {
              await update('admins', { id: userId }, {
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              console.log(`[AUTH] Updated last_login_at for admin ${userId}`);
            } catch (updateErr) {
              console.warn(`[AUTH] Could not update admin last_login_at:`, updateErr);
              // Continue anyway - update is not critical
            }
          } else {
            // ✅ FIX: In UAT mode, allow admin login even if not in database
            if (isUATMode) {
              console.log(`[AUTH] UAT Mode: Admin ${phone} not in database, allowing login`);
              userId = `uat_admin_${phone}`;
              userData = {
                id: userId,
                phone: phone,
                email: `${phone}@warmpawz.app`,
                name: 'UAT Admin',
                role: 'admin',
                is_active: true,
                created_at: new Date().toISOString(),
              };
            } else {
              return this.error('Admin not found', 404, 'NOT_FOUND', undefined, context.requestId);
            }
          }
        } catch (dbError: any) {
          // ✅ FIX: If admins table doesn't exist, allow in UAT mode
          if (isUATMode && (dbError.message?.includes('does not exist') || dbError.message?.includes('relation') || dbError.code === '42P01')) {
            console.log(`[AUTH] UAT Mode: admins table not found, allowing admin login for ${phone}`);
            userId = `uat_admin_${phone}`;
            userData = {
              id: userId,
              phone: phone,
              email: `${phone}@warmpawz.app`,
              name: 'UAT Admin',
              role: 'admin',
              is_active: true,
              created_at: new Date().toISOString(),
            };
          } else {
            console.error('[AUTH] Error querying admins table:', dbError);
            return this.error('Admin authentication failed', 500, 'INTERNAL_ERROR', { details: dbError.message }, context.requestId);
          }
        }
      } else {
        return this.error('Invalid role', 400, 'VALIDATION_ERROR', undefined, context.requestId);
      }

      // ✅ FIX: Ensure userId and userData are always defined (safety check)
      // This must happen before we use userId to generate tokens
      if (!userId || userId === '') {
        console.error('[AUTH] ❌ userId is not set - this should not happen');
        // Generate a fallback userId based on role and phone
        userId = role === 'vendor'
          ? `temp_vendor_${phone}_${Date.now()}`
          : role === 'customer'
            ? `temp_customer_${phone}_${Date.now()}`
            : `temp_${role}_${phone}_${Date.now()}`;
        console.warn(`[AUTH] ⚠️ Generated fallback userId: ${userId}`);
      }

      if (!userData) {
        console.error('[AUTH] ❌ userData is not set - this should not happen');
        // Generate a fallback userData based on role
        userData = {
          id: userId,
          phone,
          is_active: true,
          status: role === 'vendor' ? 'pending' : 'new',
          onboarding_status: role === 'vendor' ? 'INIT' : 'PHONE_VERIFIED',
          created_at: new Date().toISOString(),
        };
        if (role === 'vendor') {
          userData.business_name = null;
        } else if (role === 'customer') {
          userData.full_name = null;
          userData.email = null;
        }
        console.warn(`[AUTH] ⚠️ Generated fallback userData for role: ${role}`);
      }

      // Get or create Cognito user

      let cognitoTokens: CognitoTokens;
      // UAT MODE: Generate proper JWT tokens (not just strings)
      // Token expiry set to 24h so post-OTP redirect and first API calls succeed (was 60s → caused 401 and redirect back to login)
      //const { generateUATJWTToken } = await import('../utils/jwt-generator');
      if (isUATMode) {

        cognitoTokens = await generateUATJWTToken({
          userId,
          phone,
          role: role as 'customer' | 'vendor' | 'admin',
          expiresIn: 24 * 60 * 60,
        });
        console.log('[AUTH] UAT Mode: Generated JWT tokens with 24h expiry');
      } else {
        // PRODUCTION MODE: Use full Cognito authentication
        // ✅ FIX: Check if Cognito is configured, fallback to JWT if not
        const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID ||
          process.env.COGNITO_VENDOR_POOL_ID ||
          process.env.COGNITO_CUSTOMER_POOL_ID ||
          '';

        if (!cognitoUserPoolId) {
          // Cognito not configured - use JWT tokens as fallback (same as UAT mode)
          console.warn(`[AUTH] Production Mode: Cognito not configured (no COGNITO_USER_POOL_ID), using JWT tokens as fallback`);
          cognitoTokens = await generateUATJWTToken({
            userId,
            phone,
            role: role as 'customer' | 'vendor' | 'admin',
            expiresIn: 24 * 60 * 60, // 24 hours
          });
          console.log('[AUTH] Production Mode: Generated JWT tokens (Cognito fallback)');
        } else {
          // Cognito is configured - use it
          try {

            // ✅ FIX: Add timeout protection for Cognito operations (8 seconds max)
            // This prevents Lambda timeout if Cognito is slow or unresponsive
            const COGNITO_TIMEOUT_MS = 8000; // 8 seconds

            const cognitoAuthPromise = (async () => {
              const cognitoUser = await getOrCreateCognitoUser(phone, undefined, role);
              const tokens = await authenticateCognitoUser(phone);
              return tokens;
            })();

            const cognitoTimeout = new Promise<CognitoTokens>((_, reject) =>
              setTimeout(() => reject(new Error('Cognito authentication timeout after 8 seconds')), COGNITO_TIMEOUT_MS)
            );

            cognitoTokens = await Promise.race([cognitoAuthPromise, cognitoTimeout]);
          } catch (cognitoError: any) {
            console.error('[AUTH] Production Mode: Cognito authentication failed:', cognitoError);

            // ✅ FIX: If Cognito fails, fallback to JWT tokens instead of returning 503
            // This ensures the endpoint works even if Cognito has issues
            console.warn(`[AUTH] Production Mode: Cognito failed, falling back to JWT tokens`);
            try {
              cognitoTokens = await generateUATJWTToken({
                userId,
                phone,
                role: role as 'customer' | 'vendor' | 'admin',
                expiresIn: 24 * 60 * 60, // 24 hours
              });
              console.log('[AUTH] Production Mode: Generated JWT tokens (Cognito fallback after error)');
            } catch (jwtError: any) {
              console.error('[AUTH] Production Mode: JWT fallback also failed:', jwtError);
              // Only return 503 if both Cognito and JWT fail
              return this.error(
                'Authentication service temporarily unavailable. Please try again.',
                503,
                'SERVICE_UNAVAILABLE',
                { details: 'Authentication service error' },
                context.requestId
              );
            }
          }
        }
      }

      // Determine if user is new or existing using state management
      // const { getCustomerStateForAuth } = await import('../utils/customer-state');
      let isNewUser = false;
      if (role === 'customer') {
        const customerState = await getCustomerStateForAuth(userId);
        isNewUser = customerState === 'new';
      } else if (role === 'vendor') {
        isNewUser = (userId && userId.startsWith('temp_vendor_')) || !userData?.id || !userData?.created_at ||
          (userData?.onboarding_status && ['INIT', 'ROLE_PENDING'].includes(userData.onboarding_status));
      }

      // Return standardized response with state information
      return this.success({
        success: true,
        data: {
          token: {
            access_token: cognitoTokens.accessToken,
            refresh_token: cognitoTokens.refreshToken,
            expires_in: cognitoTokens.expiresIn,
            token_type: 'Bearer',
          },
          user: {
            id: userId,
            phone,
            role,
            is_active: userData?.is_active !== false,
            created_at: userData?.created_at || new Date().toISOString(),
          },
          state: isNewUser ? 'new' : 'existing',
          profile: role === 'customer' ? {
            id: userId,
            phone,
            full_name: userData?.full_name || null,
            email: userData?.email || null,
          } : role === 'vendor' ? {
            id: (userId && userId.startsWith('temp_vendor_')) ? null : userId,
            phone,
            business_name: userData?.business_name || null,
            status: userData?.status || 'pending',
            onboarding_status: userData?.onboarding_status || 'INIT',
          } : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: context.requestId,
          version: 'v1',
        },
      }, context.requestId);

    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return this.error(
        'Failed to verify OTP',
        500,
        'INTERNAL_ERROR',
        { details: error.message },
        context.requestId
      );
    }

  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerAuthEndpointsEnhanced(app: Hono) {
  const sendOtpHandler = new SendOtpHandlerEnhanced();
  const verifyOtpHandler = new VerifyOtpHandlerEnhanced();

  app.post('/auth/send-otp', async (c) => {
    try {
      const event = await createApiGatewayEvent(c);
      const context = createLambdaContext();
      const result: any = await sendOtpHandler.execute(event, context);
      const body = JSON.parse(result.body);
      return c.json(body, result.statusCode);
    } catch (error: any) {
      console.error('[AUTH] Error in send-otp handler:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  // Compatibility alias: /auth/otp/send (for web/mobile clients)
  app.post('/auth/otp/send', async (c) => {
    try {
      const event = await createApiGatewayEvent(c);
      const context = createLambdaContext();
      const result: any = await sendOtpHandler.execute(event, context);
      const body = JSON.parse(result.body);
      return c.json(body, result.statusCode);
    } catch (error: any) {
      console.error('[AUTH] Error in otp/send handler:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/auth/verify-otp', async (c) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 25000; // 25 seconds (leave 5s buffer before API Gateway 30s limit)

    try {
      // Add timeout protection for JSON parsing
      const parseBodyWithTimeout = async (): Promise<any> => {
        return Promise.race([
          c.req.json(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request body parsing timeout')), 5000)
          )
        ]);
      };

      let event;
      try {
        event = await createApiGatewayEvent(c, parseBodyWithTimeout);
      } catch (parseError: any) {
        console.error('[AUTH] Error parsing request body:', parseError);
        return c.json({
          message: 'Invalid request format',
          error: parseError.message || 'Request parsing failed'
        }, 400);
      }

      const context = createLambdaContext();

      // Add timeout protection for handler execution
      const handlerPromise = verifyOtpHandler.execute(event, context);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Handler execution timeout')), TIMEOUT_MS)
      );

      const result: any = await Promise.race([handlerPromise, timeoutPromise]);

      if (!result || !result.body) {
        throw new Error('Handler returned invalid response');
      }

      const body = JSON.parse(result.body);
      const elapsed = Date.now() - startTime;
      console.log(`[AUTH] verify-otp completed in ${elapsed}ms`);

      return c.json(body, result.statusCode);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[AUTH] Error in verify-otp handler (${elapsed}ms):`, error);
      console.error('[AUTH] Error stack:', error?.stack);

      // Return 503 for timeout errors, 500 for other errors
      const statusCode = error?.message?.includes('timeout') ? 503 : 500;
      const errorMessage = error?.message || 'Internal Server Error';

      return c.json({
        message: statusCode === 503 ? 'Service Unavailable' : 'Internal Server Error',
        error: errorMessage
      }, statusCode);
    }
  });

  // Compatibility alias: /auth/otp/verify (for web/mobile clients)
  app.post('/auth/otp/verify', async (c) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 25000; // 25 seconds (leave 5s buffer before API Gateway 30s limit)

    try {
      // Add timeout protection for JSON parsing
      const parseBodyWithTimeout = async (): Promise<any> => {
        return Promise.race([
          c.req.json(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request body parsing timeout')), 5000)
          )
        ]);
      };

      let event;
      try {
        event = await createApiGatewayEvent(c, parseBodyWithTimeout);
      } catch (parseError: any) {
        console.error('[AUTH] Error parsing request body:', parseError);
        return c.json({
          message: 'Invalid request format',
          error: parseError.message || 'Request parsing failed'
        }, 400);
      }

      const context = createLambdaContext();

      // Add timeout protection for handler execution
      const handlerPromise = verifyOtpHandler.execute(event, context);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Handler execution timeout')), TIMEOUT_MS)
      );

      const result: any = await Promise.race([handlerPromise, timeoutPromise]);

      if (!result || !result.body) {
        throw new Error('Handler returned invalid response');
      }

      const body = JSON.parse(result.body);
      const elapsed = Date.now() - startTime;
      console.log(`[AUTH] otp/verify completed in ${elapsed}ms`);

      return c.json(body, result.statusCode);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[AUTH] Error in otp/verify handler (${elapsed}ms):`, error);
      console.error('[AUTH] Error stack:', error?.stack);

      // Return 503 for timeout errors, 500 for other errors
      const statusCode = error?.message?.includes('timeout') ? 503 : 500;
      const errorMessage = error?.message || 'Internal Server Error';

      return c.json({
        message: statusCode === 503 ? 'Service Unavailable' : 'Internal Server Error',
        error: errorMessage
      }, statusCode);
    }
  });
}

async function createApiGatewayEvent(c: any, bodyParser?: () => Promise<any>): Promise<any> {
  // Get body from Hono request with optional custom parser
  let body: any = {};
  try {
    if (bodyParser) {
      body = await bodyParser();
    } else {
      // Default: try to parse with timeout
      body = await Promise.race([
        c.req.json(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Body parsing timeout')), 5000)
        )
      ]);
    }
    // Log referral code if present for debugging
    if (body?.referralCode || body?.pendingReferralCode) {
      console.log(`[AUTH] ✅ Referral code found in parsed body: ${body.referralCode || body.pendingReferralCode}`);
    }
  } catch (error: any) {
    console.warn('[AUTH] Error parsing request body, using empty object:', error?.message);
    body = {};
  }

  // Get headers - Hono's c.req.raw contains the raw request
  const headers: Record<string, string> = {};
  try {
    if (c.req.raw && c.req.raw.headers) {
      // Access raw headers from Node.js request
      const rawHeaders = c.req.raw.headers;
      for (const key in rawHeaders) {
        const value = rawHeaders[key];
        if (value) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
      }
    } else {
      // Fallback: get common headers via Hono's header() method
      const contentType = c.req.header('content-type');
      const authorization = c.req.header('authorization');
      if (contentType) headers['content-type'] = contentType;
      if (authorization) headers['authorization'] = authorization;
    }
  } catch (e) {
    console.warn('[AUTH] Error processing headers:', e);
  }

  const url = new URL(c.req.url);
  // Ensure body is stringified for API Gateway event format
  const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;
  if (body?.referralCode || body?.pendingReferralCode) {
    console.log(`[AUTH] ✅ Body stringified with referral code: ${bodyString?.substring(0, 200)}`);
  }
  return {
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1), // Remove leading '?'
    body: bodyString,
    isBase64Encoded: false,
    requestContext: {
      http: {
        method: c.req.method || 'POST',
        path: url.pathname,
      },
      requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    },
    headers: headers,
  };
}

function createLambdaContext(): any {
  return {
    awsRequestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}
