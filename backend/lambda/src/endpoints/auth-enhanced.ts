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
import { sendSMS } from '../utils/sms-service';
import { query, select, insert, update } from '../database/rds-connection';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { 
  getOrCreateCognitoUser, 
  authenticateCognitoUser,
  verifyCognitoToken,
  CognitoTokens 
} from '../utils/cognito-client';

import { 
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
} from '@warmpawz/api-contracts/auth';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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
      
      // ✅ DEBUG: Log OTP clearly for testing
      console.log(`[DEBUG] OTP GENERATED FOR ${phone}: ${otpCode}`);
      console.log(`[DEBUG] Phone normalized: ${normalizedPhone}, OTP: ${otpCode}`);
      
      // ✅ FIX: Store OTP with timeout protection (3 seconds max)
      const otpStoreStartTime = Date.now();
      try {
        // ✅ FIX: Use normalizedPhone for storing OTP (must match verification)
        const createOtpPromise = createOtp(normalizedPhone, otpCode, body.role || 'login');
        console.log(`[DEBUG] Storing OTP: phone=${normalizedPhone}, otp=${otpCode}, role=${body.role || 'login'}`);
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
        
        // ✅ PRODUCTION FIX: Increase timeout to 10 seconds and add retry logic
        let smsResult = false;
        let lastError: any = null;
        const maxRetries = 2;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[AUTH] SMS send attempt ${attempt}/${maxRetries} to ${normalizedPhone}`);
            smsResult = await Promise.race([
              sendSmsViaSns(normalizedPhone, message),
              new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error(`SMS send timeout after 10s (attempt ${attempt})`)), 10000)),
            ]);
            
            if (smsResult) {
              console.log(`[AUTH] ✅ SMS accepted by SNS on attempt ${attempt} (delivery depends on SNS sandbox/production)`);
              break;
            }
          } catch (err: any) {
            lastError = err;
            console.error(`[AUTH] ❌ SMS send failed on attempt ${attempt}/${maxRetries}:`, err?.message || err);
            if (err?.Code) console.error('[AUTH] SNS Error Code:', err.Code);
            if (err?.$metadata?.httpStatusCode) console.error('[AUTH] SNS HTTP Status:', err.$metadata.httpStatusCode);
            if (err?.$metadata?.requestId) console.error('[AUTH] SNS Request ID:', err.$metadata.requestId);
            
            // If it's a connection timeout, wait before retry
            if (err?.message?.includes('ETIMEDOUT') || err?.message?.includes('timeout')) {
              if (attempt < maxRetries) {
                const waitMs = 1000 * attempt; // Exponential backoff: 1s, 2s
                console.log(`[AUTH] Waiting ${waitMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
              }
            } else {
              // For non-timeout errors, don't retry
              break;
            }
          }
        }
        
        if (!smsResult && lastError) {
          console.error(`[AUTH] ❌ SMS send failed after ${maxRetries} attempts. Last error:`, lastError?.message || lastError);
          console.error('[AUTH] ⚠️ OTP was stored in database but SMS delivery failed. User may need to request OTP again.');
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

// ✅ APPROACH 51-60: Dedicated function to process customer referral code
async function processCustomerReferralCode(
  referralCode: string | null | undefined,
  phone: string
): Promise<any> {
  const metadata: any = {};
  
  if (!referralCode || typeof referralCode !== 'string' || referralCode.trim().length === 0) {
    console.error(`[REFERRAL-PROCESSOR] No valid referral code provided`);
    return metadata;
  }
  
  const trimmedCode = referralCode.trim().toUpperCase();
  console.error(`[REFERRAL-PROCESSOR] Processing code: ${trimmedCode} for phone: ${phone}`);
  
  try {
    const { query } = await import('../database/rds-connection');
    const phoneDigits = phone.replace(/\D/g, '');
    const fullPhoneForComparison = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
    
    // Check existing referral
    const existingCheck = await query(
      `SELECT * FROM customer_referrals 
       WHERE referral_code = $1 AND referred_phone = $2
       LIMIT 1`,
      [trimmedCode, fullPhoneForComparison]
    );
    
    let referralRecord: any = null;
    
    if (existingCheck.rows.length > 0) {
      referralRecord = existingCheck.rows[0];
      console.error(`[REFERRAL-PROCESSOR] Found existing record: ${referralRecord.id}`);
    } else {
      // Lookup code
      const codeLookup = await query(
        `SELECT referrer_customer_id, id FROM customer_referrals 
         WHERE referral_code = $1 
         ORDER BY created_at ASC
         LIMIT 1`,
        [trimmedCode]
      );
      
      if (codeLookup.rows.length > 0) {
        const referrerCustomerId = codeLookup.rows[0].referrer_customer_id;
        const existingReferralId = codeLookup.rows[0].id;
        
        // Update or create
        const updateResult = await query(
          `UPDATE customer_referrals 
           SET referred_phone = $1,
               status = 'applied',
               applied_at = NOW(),
               updated_at = NOW()
           WHERE id = $2 AND (referred_phone = '' OR referred_phone IS NULL)
           RETURNING *`,
          [fullPhoneForComparison, existingReferralId]
        );
        
        if (updateResult.rows.length > 0) {
          referralRecord = updateResult.rows[0];
        } else {
          const newReferral = await query(
            `INSERT INTO customer_referrals 
             (referrer_customer_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
             VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
             ON CONFLICT (referrer_customer_id, referred_phone)
             DO UPDATE SET 
               referral_code = EXCLUDED.referral_code,
               status = 'applied',
               applied_at = NOW(),
               updated_at = NOW()
             RETURNING *`,
            [referrerCustomerId, trimmedCode, fullPhoneForComparison]
          );
          if (newReferral.rows.length > 0) {
            referralRecord = newReferral.rows[0];
          }
        }
      }
    }
    
    if (referralRecord) {
      metadata.referral_code_id = referralRecord.id;
      metadata.referrer_customer_id = referralRecord.referrer_customer_id;
      metadata.referral_code = trimmedCode;
      console.error(`[REFERRAL-PROCESSOR] ✅ Success! Metadata: ${JSON.stringify(metadata)}`);
    } else {
      console.error(`[REFERRAL-PROCESSOR] ❌ No referral record created`);
    }
  } catch (error: any) {
    console.error(`[REFERRAL-PROCESSOR] ❌ Error: ${error.message}`);
  }
  
  return metadata;
}

class VerifyOtpHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
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

    const { phone, otp, role: validatedRole } = validationResult.data;
    
    // ✅ APPROACH 1-10: Extract referral code from body with multiple fallbacks
    // Try every possible field name and location - CRITICAL: Extract BEFORE any other processing
    const referralCode = 
      body?.referralCode || 
      body?.referral_code || 
      (body as any)?.referralCode ||
      (body as any)?.referral_code ||
      context.event?.body ? (typeof context.event.body === 'string' ? (() => { try { return JSON.parse(context.event.body)?.referralCode; } catch { return null; } })() : context.event.body?.referralCode) : null ||
      null;
    
    // ✅ CRITICAL: Log immediately after extraction
    console.error(`[AUTH] ========================================`);
    console.error(`[AUTH] 🔍 REFERRAL CODE EXTRACTION 🔍`);
    console.error(`[AUTH] Body keys: ${Object.keys(body || {}).join(', ')}`);
    console.error(`[AUTH] body.referralCode: ${body?.referralCode || 'NOT FOUND'}`);
    console.error(`[AUTH] body.referral_code: ${body?.referral_code || 'NOT FOUND'}`);
    console.error(`[AUTH] Extracted referralCode: ${referralCode || 'NULL'}`);
    console.error(`[AUTH] referralCode type: ${typeof referralCode}`);
    console.error(`[AUTH] ========================================`);
    
    // ✅ AGGRESSIVE LOGGING: Force log to stderr
    console.error(`[AUTH] ========================================`);
    console.error(`[AUTH] 📥 📥 📥 REQUEST BODY PARSED 📥 📥 📥`);
    console.error(`[AUTH] Phone: ${phone}`);
    console.error(`[AUTH] OTP: ${otp}`);
    console.error(`[AUTH] Validated Role: ${validatedRole || 'NOT PROVIDED'}`);
    console.error(`[AUTH] Body Role: ${body.role || 'NOT PROVIDED'}`);
    console.error(`[AUTH] Referral Code from body.referralCode: ${body.referralCode || 'NOT PROVIDED'}`);
    console.error(`[AUTH] Referral Code from body.referral_code: ${body.referral_code || 'NOT PROVIDED'}`);
    console.error(`[AUTH] Final referralCode variable: ${referralCode || 'NOT PROVIDED'}`);
    console.error(`[AUTH] Referral Code type: ${typeof referralCode}`);
    console.error(`[AUTH] Full body keys: ${Object.keys(body).join(', ')}`);
    console.error(`[AUTH] Full body: ${JSON.stringify(body)}`);
    console.error(`[AUTH] Validation result keys: ${Object.keys(validationResult.data).join(', ')}`);
    console.error(`[AUTH] ========================================`);

    // Check if UAT mode is enabled - ONLY check UAT_MODE env variable
    // This ensures PROD (UAT_MODE=false) never accepts fixed OTP 123456
    const isUATMode = process.env.UAT_MODE === 'true';

    try {
      let isValid = false;
      
      if (isUATMode && otp === '123456') {
        // UAT MODE: Accept 123456 without checking database
        console.log(`[AUTH] UAT Mode: Accepting fixed OTP 123456 for ${phone} (database check skipped)`);
        isValid = true;
        // Try to mark any existing OTP as used to clean up (non-blocking with timeout)
        // This is fire-and-forget to avoid blocking the response
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
      } else {
        // PRODUCTION MODE: Normal OTP verification against database
        console.log(`[AUTH] Production Mode: Verifying OTP against database for ${phone}`);
        // ✅ FIX: Normalize phone to match how it was stored
        const phoneDigits = phone.replace(/\D/g, '');
        let normalizedPhoneForVerification: string;
        if (phoneDigits.length === 10) {
          normalizedPhoneForVerification = `+91${phoneDigits}`;
        } else if (phoneDigits.startsWith('91') && phoneDigits.length === 12) {
          normalizedPhoneForVerification = `+${phoneDigits}`;
        } else if (phone.startsWith('+')) {
          normalizedPhoneForVerification = phone;
        } else {
          normalizedPhoneForVerification = phoneDigits ? `+${phoneDigits}` : phone;
        }
        console.log(`[DEBUG] Verifying OTP: original phone=${phone}, normalized=${normalizedPhoneForVerification}, otp=${otp}`);
        isValid = await verifyOtp(normalizedPhoneForVerification, otp);
        console.log(`[DEBUG] OTP verification result: ${isValid}`);
        if (isValid) {
          console.log(`[AUTH] Production Mode: OTP verified successfully for ${phone}`);
        } else {
          console.log(`[AUTH] Production Mode: OTP verification failed for ${phone}`);
        }
      }
      
      if (!isValid) {
        return this.error('Invalid or expired OTP', 401, 'UNAUTHORIZED', undefined, context.requestId);
      }

      // ✅ FIX: Normalize phone number for database lookups
      // OTP is stored with +91 prefix, so normalize to match
      const phoneDigits = phone.replace(/\D/g, '');
      let normalizedPhoneForVerification: string;
      if (phoneDigits.length === 10) {
        normalizedPhoneForVerification = `+91${phoneDigits}`;
      } else if (phoneDigits.startsWith('91') && phoneDigits.length === 12) {
        normalizedPhoneForVerification = `+${phoneDigits}`;
      } else if (phone.startsWith('+')) {
        normalizedPhoneForVerification = phone;
      } else {
        normalizedPhoneForVerification = phoneDigits ? `+${phoneDigits}` : phone;
      }
      console.log(`[DEBUG] Normalized phone for verification: ${phone} -> ${normalizedPhoneForVerification}`);
      
      const normalizedPhone = normalizedPhoneForVerification;

      // Get or create customer/vendor
      let role = validatedRole || body.role || 'customer';
      
      console.error(`[AUTH] ========================================`);
      console.error(`[AUTH] 🎯 🎯 🎯 ROLE DETERMINATION 🎯 🎯 🎯`);
      console.error(`[AUTH] validatedRole: ${validatedRole || 'NOT PROVIDED'}`);
      console.error(`[AUTH] body.role: ${body.role || 'NOT PROVIDED'}`);
      console.error(`[AUTH] Final role: ${role}`);
      console.error(`[AUTH] Will check: role === 'vendor' ? ${role === 'vendor'}`);
      console.error(`[AUTH] ========================================`);
      
      let userId: string;
      let userData: any;

      // ============================================================================
      // REGULAR CUSTOMER/VENDOR LOGIN
      // ============================================================================
      if (role === 'customer') {
        // ✅ FIX: Add timeout protection to customer queries
        let customers: any[] = [];
        try {
          const customerQueryPromise = select('customers', { phone });
          const customerQueryTimeout = new Promise<any[]>((_, reject) => 
            setTimeout(() => reject(new Error('Customer query timeout')), 5000)
          );
          customers = await Promise.race([customerQueryPromise, customerQueryTimeout]);
        } catch (customerQueryError: any) {
          console.warn('[AUTH] Customer query timed out or failed, treating as new customer:', customerQueryError.message);
          customers = [];
        }
        
        let isNewCustomer = false;
        
        // ✅ APPROACH 31-50: Process referral code FIRST with multiple extraction and processing strategies
        // This ensures referral code is processed even if customer already exists
        let referralMetadata: any = {};
        
        // ✅ APPROACH 31: Extract referral code with multiple fallbacks (already done above, but ensure it's set)
        const finalReferralCode = referralCode || 
          (body as any)?.referralCode || 
          (body as any)?.referral_code ||
          null;
        
        console.error(`[AUTH] ========================================`);
        console.error(`[AUTH] 🔍 CHECKING REFERRAL CODE PROCESSING 🔍`);
        console.error(`[AUTH] referralCode (original): ${referralCode}`);
        console.error(`[AUTH] finalReferralCode: ${finalReferralCode}`);
        console.error(`[AUTH] referralCode type: ${typeof referralCode}`);
        console.error(`[AUTH] finalReferralCode type: ${typeof finalReferralCode}`);
        console.error(`[AUTH] referralCode truthy: ${!!referralCode}`);
        console.error(`[AUTH] finalReferralCode truthy: ${!!finalReferralCode}`);
        console.error(`[AUTH] ========================================`);
        
        // ✅ APPROACH 32-40: Process referral code with the extracted value
        const codeToProcess = finalReferralCode || referralCode;
        
        if (codeToProcess && typeof codeToProcess === 'string' && codeToProcess.trim().length > 0) {
          const trimmedCode = referralCode.trim().toUpperCase();
          console.error(`[AUTH] ========================================`);
          console.error(`[AUTH] 🎁 🎁 🎁 PROCESSING CUSTOMER REFERRAL CODE 🎁 🎁 🎁`);
          console.error(`[AUTH] Referral Code: ${trimmedCode}`);
          console.error(`[AUTH] Phone: ${phone}`);
          console.error(`[AUTH] Customer exists: ${customers.length > 0}`);
          console.error(`[AUTH] ========================================`);
          
          try {
            // Normalize phone for comparison
            const phoneDigits = phone.replace(/\D/g, '');
            const fullPhoneForComparison = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
            console.error(`[AUTH] Full phone for comparison: ${fullPhoneForComparison}`);
            
            // Check if referral record already exists for this phone
            const { query } = await import('../database/rds-connection');
            const existingReferral = await query(
              `SELECT * FROM customer_referrals 
               WHERE referral_code = $1 
               AND referred_phone = $2
               LIMIT 1`,
              [trimmedCode, fullPhoneForComparison]
            );
            
            console.error(`[AUTH] Existing referral check: ${existingReferral.rows.length} results`);
            
            let referralRecord: any;
            
            if (existingReferral.rows.length > 0) {
              referralRecord = existingReferral.rows[0];
              console.error(`[AUTH] ✅ Found existing customer referral record ${referralRecord.id}`);
            } else {
              // Find referral code by code (might have empty referred_phone)
              console.error(`[AUTH] Looking up referral code: ${trimmedCode}`);
              const codeLookup = await query(
                `SELECT referrer_customer_id, id FROM customer_referrals 
                 WHERE referral_code = $1 
                 ORDER BY created_at ASC
                 LIMIT 1`,
                [trimmedCode]
              );
              
              console.error(`[AUTH] Code lookup results: ${codeLookup.rows.length}`);
              
              if (codeLookup.rows.length > 0) {
                const referrerCustomerId = codeLookup.rows[0].referrer_customer_id;
                const existingReferralId = codeLookup.rows[0].id;
                console.error(`[AUTH] Found referrer customer ID: ${referrerCustomerId}`);
                console.error(`[AUTH] Existing referral record ID: ${existingReferralId}`);
                
                // Try to update existing record if it has empty referred_phone, otherwise create new
                try {
                  const updateResult = await query(
                    `UPDATE customer_referrals 
                     SET referred_phone = $1,
                         status = 'applied',
                         applied_at = NOW(),
                         updated_at = NOW()
                     WHERE id = $2 AND (referred_phone = '' OR referred_phone IS NULL)
                     RETURNING *`,
                    [fullPhoneForComparison, existingReferralId]
                  );
                  
                  if (updateResult.rows.length > 0) {
                    referralRecord = updateResult.rows[0];
                    console.error(`[AUTH] ✅ Updated existing referral record ${referralRecord.id} with phone`);
                  } else {
                    // ✅ CRITICAL FIX: Always create new referral record for this phone
                    // Even if the code was used before, we need a record for THIS phone
                    console.error(`[AUTH] Existing record has phone ${existingReferredPhone}, creating new record for ${fullPhoneForComparison}`);
                    const newReferral = await query(
                      `INSERT INTO customer_referrals 
                       (referrer_customer_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
                       VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
                       ON CONFLICT (referrer_customer_id, referred_phone)
                       DO UPDATE SET 
                         referral_code = EXCLUDED.referral_code,
                         status = 'applied',
                         applied_at = COALESCE(customer_referrals.applied_at, NOW()),
                         updated_at = NOW()
                       RETURNING *`,
                      [referrerCustomerId, trimmedCode, fullPhoneForComparison]
                    );
                    
                    if (newReferral.rows.length > 0) {
                      referralRecord = newReferral.rows[0];
                      console.error(`[AUTH] ✅ Created/Updated customer referral record ${referralRecord.id} for phone ${fullPhoneForComparison}`);
                    } else {
                      console.error(`[AUTH] ❌ CRITICAL: INSERT returned 0 rows - this should never happen!`);
                    }
                  }
                } catch (insertError: any) {
                  console.error(`[AUTH] ❌ ❌ ❌ CRITICAL ERROR creating/updating referral record ❌ ❌ ❌`);
                  console.error(`[AUTH] Error message: ${insertError.message}`);
                  console.error(`[AUTH] Error code: ${insertError.code}`);
                  console.error(`[AUTH] Error detail: ${insertError.detail}`);
                  console.error(`[AUTH] Error stack: ${insertError.stack}`);
                  // Don't rethrow - continue without referral record
                }
              } else {
                console.error(`[AUTH] ⚠️ Customer referral code ${trimmedCode} not found in database`);
              }
            }
            
            if (referralRecord) {
              referralMetadata = {
                referral_code_id: referralRecord.id,
                referrer_customer_id: referralRecord.referrer_customer_id,
                referral_code: trimmedCode,
              };
              console.error(`[AUTH] ✅ ✅ ✅ Customer referral metadata CREATED: ${JSON.stringify(referralMetadata)}`);
              console.error(`[AUTH] ✅ referralMetadata keys: ${Object.keys(referralMetadata).length}`);
              console.error(`[AUTH] ========================================`);
            } else {
              console.error(`[AUTH] ❌ No referral record found or created`);
              console.error(`[AUTH] ========================================`);
            }
          } catch (refError: any) {
            console.error('[AUTH] ❌ ❌ ❌ ERROR processing customer referral code ❌ ❌ ❌');
            console.error('[AUTH] Error message:', refError.message);
            console.error('[AUTH] Error stack:', refError.stack);
            console.error('[AUTH] ========================================');
          }
        } else {
          console.error(`[AUTH] ⚠️ No referral code provided or invalid format`);
          console.error(`[AUTH] referralCode type: ${typeof referralCode}, value: ${referralCode}`);
        }
        
        // ✅ CRITICAL: Log referralMetadata state BEFORE customer check
        console.error(`[AUTH] ========================================`);
        console.error(`[AUTH] 📊 REFERRAL METADATA STATE BEFORE CUSTOMER CHECK 📊`);
        console.error(`[AUTH] referralMetadata keys: ${Object.keys(referralMetadata).length}`);
        console.error(`[AUTH] referralMetadata: ${JSON.stringify(referralMetadata)}`);
        console.error(`[AUTH] ========================================`);
        
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
          
          // ✅ CRITICAL: Update customer_identity with referral metadata if available
          let identityId: string | undefined;
          try {
            const { createOrUpdateCustomerIdentity } = await import('../utils/customer-state');
            const identityPromise = createOrUpdateCustomerIdentity(phone, userId);
            const identityTimeout = new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Identity creation timeout')), 5000)
            );
            identityId = await Promise.race([identityPromise, identityTimeout]);
            
            // Update identity with referral metadata if available
            if (identityId && Object.keys(referralMetadata).length > 0) {
              try {
                const { query } = await import('../database/rds-connection');
                const phoneDigits = phone.replace(/\D/g, '');
                const normalizedPhoneForDb = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
                
                console.error(`[AUTH] Attempting to update customer_identity ${identityId} with referral metadata...`);
                console.error(`[AUTH] Referral metadata: ${JSON.stringify(referralMetadata)}`);
                console.error(`[AUTH] Referral metadata keys: ${Object.keys(referralMetadata).length}`);
                
                // ✅ CRITICAL: Use phone-based update as fallback if ID-based update fails
                
                let updateResult = await query(
                  `UPDATE customer_identity 
                   SET metadata = $1::jsonb, updated_at = NOW()
                   WHERE id = $2
                   RETURNING id, phone, metadata`,
                  [JSON.stringify(referralMetadata), identityId]
                );
                
                // If ID-based update failed, try phone-based update
                if (updateResult.rows.length === 0) {
                  console.error(`[AUTH] ⚠️ ID-based update returned 0 rows, trying phone-based update...`);
                  updateResult = await query(
                    `UPDATE customer_identity 
                     SET metadata = $1::jsonb, updated_at = NOW()
                     WHERE phone = $2
                     RETURNING id, phone, metadata`,
                    [JSON.stringify(referralMetadata), normalizedPhoneForDb]
                  );
                }
                
                if (updateResult.rows.length > 0) {
                  let updatedMetadata = updateResult.rows[0].metadata || {};
                  if (typeof updatedMetadata === 'string') {
                    try {
                      updatedMetadata = JSON.parse(updatedMetadata);
                    } catch (e) {
                      updatedMetadata = {};
                    }
                  }
                  console.error(`[AUTH] ✅ Updated existing customer_identity ${updateResult.rows[0].id} with referral metadata`);
                  console.error(`[AUTH] Updated metadata: ${JSON.stringify(updatedMetadata)}`);
                  console.error(`[AUTH] Has referral_code_id: ${!!updatedMetadata.referral_code_id}`);
                  
                  // ✅ VERIFY: Re-check metadata after update
                  const verifyUpdate = await query(
                    `SELECT metadata FROM customer_identity WHERE id = $1`,
                    [updateResult.rows[0].id]
                  );
                  if (verifyUpdate.rows.length > 0) {
                    let verifiedMeta = verifyUpdate.rows[0].metadata || {};
                    if (typeof verifiedMeta === 'string') {
                      try {
                        verifiedMeta = JSON.parse(verifiedMeta);
                      } catch (e) {
                        verifiedMeta = {};
                      }
                    }
                    console.error(`[AUTH] ✅ Verified metadata after update: ${JSON.stringify(verifiedMeta)}`);
                  }
                } else {
                  console.error(`[AUTH] ❌ CRITICAL: Both ID and phone-based updates returned 0 rows!`);
                  console.error(`[AUTH] Identity ID: ${identityId}, Phone: ${normalizedPhoneForDb}`);
                }
              } catch (updateError: any) {
                console.error(`[AUTH] ❌ Error updating customer_identity with referral metadata: ${updateError.message}`);
                console.error(`[AUTH] Error stack: ${updateError.stack}`);
              }
            } else {
              if (!identityId) {
                console.error(`[AUTH] ⚠️ No identityId available to update with referral metadata`);
              }
              if (Object.keys(referralMetadata).length === 0) {
                console.error(`[AUTH] ⚠️ No referral metadata to update (referralMetadata is empty)`);
              }
            }
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
        } else {
          // Create customer with proper state
          isNewCustomer = true;
          
          // ✅ CRITICAL FIX: Process referral code INSIDE else block (SAME AS VENDOR)
          // This ensures it runs right before identity creation
          console.error(`[AUTH] ========================================`);
          console.error(`[AUTH] ⚠️  ⚠️  ⚠️  ELSE BLOCK REACHED - NO CUSTOMER_IDENTITY FOUND ⚠️  ⚠️  ⚠️`);
          console.error(`[AUTH] Phone: ${phone}`);
          console.error(`[AUTH] Referral Code: ${referralCode || 'NOT PROVIDED'}`);
          console.error(`[AUTH] Customers length: ${customers.length}`);
          console.error(`[AUTH] About to process referral and create customer_identity...`);
          console.error(`[AUTH] ========================================`);
          
          // Normalize phone for customer_identity (stores 10-digit format)
          const phoneDigits = phone.replace(/\D/g, '');
          let normalizedPhoneForDb = phoneDigits.length > 10 
            ? phoneDigits.slice(-10)  
            : phoneDigits.length === 9 
              ? '0' + phoneDigits      
              : phoneDigits;
          
          // ✅ CRITICAL: Process referral code HERE (inside else block, like vendor)
          let referralMetadata: any = {};
          if (referralCode && typeof referralCode === 'string' && referralCode.trim().length > 0) {
            try {
              const trimmedCode = referralCode.trim().toUpperCase();
              console.error(`[AUTH] 🔍 Processing referral code for new customer: ${trimmedCode}`);
              
              const fullPhoneForComparison = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
              
              const { query } = await import('../database/rds-connection');
              
              // Check if referral record already exists
              const existingReferral = await query(
                `SELECT * FROM customer_referrals 
                 WHERE referral_code = $1 
                 AND referred_phone = $2
                 LIMIT 1`,
                [trimmedCode, fullPhoneForComparison]
              );
              
              let referralRecord: any;
              
              if (existingReferral.rows.length > 0) {
                referralRecord = existingReferral.rows[0];
                console.error(`[AUTH] ✅ Found existing customer referral record ${referralRecord.id}`);
              } else {
                // Find referrer customer ID - look for ANY record with this code
                const codeLookup = await query(
                  `SELECT referrer_customer_id, id, referred_phone, status 
                   FROM customer_referrals 
                   WHERE referral_code = $1 
                   ORDER BY created_at ASC
                   LIMIT 1`,
                  [trimmedCode]
                );
                
                console.error(`[AUTH] Code lookup result: ${codeLookup.rows.length} records found for code ${trimmedCode}`);
                
                if (codeLookup.rows.length > 0) {
                  const referrerCustomerId = codeLookup.rows[0].referrer_customer_id;
                  const existingReferralId = codeLookup.rows[0].id;
                  const existingReferredPhone = codeLookup.rows[0].referred_phone;
                  
                  console.error(`[AUTH] Found referrer: ${referrerCustomerId}, existing phone: ${existingReferredPhone || 'NULL'}`);
                  
                  // ✅ CRITICAL FIX: Always create a NEW record for this phone, even if code was used before
                  // Multiple customers can use the same referral code (one record per phone)
                  console.error(`[AUTH] Creating new referral record for phone ${fullPhoneForComparison} with code ${trimmedCode}`);
                  const newReferral = await query(
                    `INSERT INTO customer_referrals 
                     (referrer_customer_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
                     VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
                     ON CONFLICT (referrer_customer_id, referred_phone)
                     DO UPDATE SET 
                       referral_code = EXCLUDED.referral_code,
                       status = 'applied',
                       applied_at = COALESCE(customer_referrals.applied_at, NOW()),
                       updated_at = NOW()
                     RETURNING *`,
                    [referrerCustomerId, trimmedCode, fullPhoneForComparison]
                  );
                  
                  if (newReferral.rows.length > 0) {
                    referralRecord = newReferral.rows[0];
                    console.error(`[AUTH] ✅ Created/Updated customer referral record ${referralRecord.id} for phone ${fullPhoneForComparison}`);
                    console.error(`[AUTH] ✅ Referral record details: ${JSON.stringify({
                      id: referralRecord.id,
                      referrer: referralRecord.referrer_customer_id,
                      phone: referralRecord.referred_phone,
                      code: referralRecord.referral_code,
                      status: referralRecord.status
                    })}`);
                  } else {
                    console.error(`[AUTH] ❌ CRITICAL: Failed to create/update referral record - INSERT returned 0 rows!`);
                    console.error(`[AUTH] This should never happen with RETURNING *`);
                  }
                } else {
                  console.error(`[AUTH] ⚠️ Customer referral code ${trimmedCode} not found in database`);
                  console.error(`[AUTH] ⚠️ This means the referral code doesn't exist. Referrer needs to generate it first.`);
                }
              }
              
              if (referralRecord) {
                referralMetadata = {
                  referral_code_id: referralRecord.id,
                  referrer_customer_id: referralRecord.referrer_customer_id,
                  referral_code: trimmedCode,
                };
                console.error(`[AUTH] ✅ ✅ ✅ Customer referral metadata CREATED: ${JSON.stringify(referralMetadata)}`);
                
                // ✅ CRITICAL: Award points to referrer IMMEDIATELY when account is created
                try {
                  const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
                  const pointsResult = await loyaltyPointsService.awardPoints({
                    customerId: referralRecord.referrer_customer_id,
                    actionName: 'customer_referral',
                    referenceType: 'customer_referral',
                    referenceId: referralRecord.id,
                    description: `Customer referral: New customer registered with code ${trimmedCode}`,
                    requestId: context.requestId,
                  });
                  
                  console.error(`[AUTH] ✅ ✅ ✅ POINTS AWARDED TO REFERRER IMMEDIATELY ✅ ✅ ✅`);
                  console.error(`[AUTH] Referrer Customer ID: ${referralRecord.referrer_customer_id}`);
                  console.error(`[AUTH] Points Awarded: ${pointsResult.points}`);
                  console.error(`[AUTH] Wallet Credited: ₹${pointsResult.walletCredited}`);
                  
                  // Update referral status to 'approved' since points are awarded immediately
                  await query(
                    `UPDATE customer_referrals 
                     SET status = 'approved',
                         approved_at = NOW(),
                         updated_at = NOW()
                     WHERE id = $1`,
                    [referralRecord.id]
                  );
                  console.error(`[AUTH] ✅ Updated referral record status to 'approved'`);
                } catch (pointsError: any) {
                  console.error(`[AUTH] ❌ Error awarding referral points: ${pointsError.message}`);
                  console.error(`[AUTH] Error stack: ${pointsError.stack}`);
                  // Don't fail account creation if points award fails
                }
              } else {
                console.error(`[AUTH] ❌ No referral record found or created`);
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ ❌ ❌ ERROR processing customer referral code ❌ ❌ ❌');
              console.error('[AUTH] Error message:', refError.message);
              console.error('[AUTH] Error stack:', refError.stack);
            }
          }
          
          console.error(`[AUTH] Referral Metadata at ELSE block: ${JSON.stringify(referralMetadata)}`);
          console.error(`[AUTH] Referral Metadata keys: ${Object.keys(referralMetadata).length}`);
          
          // ✅ CRITICAL FIX: Create customer_identity with referral in metadata
          // Use retry logic and better error handling (SAME AS VENDOR)
          let customerIdentityCreated = false;
          let retryCount = 0;
          const maxRetries = 3;
          let identityId: string | undefined;
          
          while (!customerIdentityCreated && retryCount < maxRetries) {
            try {
              console.error(`[AUTH] ========================================`);
              console.error(`[AUTH] 🚀 🚀 🚀 STARTING CUSTOMER_IDENTITY CREATION (Attempt ${retryCount + 1}/${maxRetries}) 🚀 🚀 🚀`);
              console.error(`[AUTH] Phone for DB: ${normalizedPhoneForDb}`);
              console.error(`[AUTH] Referral Metadata: ${JSON.stringify(referralMetadata)}`);
              console.error(`[AUTH] ========================================`);
              
              const insertData: any = {
                phone: normalizedPhoneForDb,
                onboarding_status: 'PHONE_VERIFIED',
              };
              
              if (Object.keys(referralMetadata).length > 0) {
                // ✅ FIX: insert() function handles JSONB automatically, but we can pass as object or string
                // Pass as object - insert() will serialize it
                insertData.metadata = referralMetadata;
                console.error(`[AUTH] ✅ Adding referral metadata: ${JSON.stringify(referralMetadata)}`);
              } else {
                console.error(`[AUTH] ⚠️  No referral metadata to add`);
              }
              
              console.error(`[AUTH] Insert data: ${JSON.stringify(insertData)}`);
              
              // ✅ CRITICAL FIX: Use direct SQL with ON CONFLICT to handle existing records
              // customer_identity has unique constraint on phone, so we need ON CONFLICT
              const { query } = await import('../database/rds-connection');
              const metadataJson = Object.keys(referralMetadata).length > 0 ? JSON.stringify(referralMetadata) : '{}';
              
              console.error(`[AUTH] 🔍 About to insert customer_identity with metadata: ${metadataJson}`);
              
              const insertResult = await query(
                `INSERT INTO customer_identity (phone, onboarding_status, metadata, created_at, updated_at)
                 VALUES ($1, $2, $3::jsonb, NOW(), NOW())
                 ON CONFLICT (phone)
                 DO UPDATE SET 
                   metadata = CASE 
                     WHEN $3::jsonb != '{}'::jsonb AND ($3::jsonb->>'referral_code_id') IS NOT NULL
                     THEN $3::jsonb  -- Always use new metadata if it has referral_code_id
                     WHEN customer_identity.metadata IS NULL OR customer_identity.metadata = '{}'::jsonb OR (customer_identity.metadata->>'referral_code_id') IS NULL
                     THEN $3::jsonb  -- Use new metadata if existing is empty or missing referral_code_id
                     ELSE customer_identity.metadata  -- Keep existing if it already has referral_code_id
                   END,
                   onboarding_status = COALESCE(EXCLUDED.onboarding_status, customer_identity.onboarding_status),
                   updated_at = NOW()
                 RETURNING id, phone, onboarding_status, metadata`,
                [normalizedPhoneForDb, 'PHONE_VERIFIED', metadataJson]
              );
              
              console.error(`[AUTH] ✅ Insert/Update result: ${insertResult.rows.length} rows`);
              if (insertResult.rows.length > 0) {
                const returnedRow = insertResult.rows[0];
                let returnedMetadata = returnedRow.metadata || {};
                if (typeof returnedMetadata === 'string') {
                  try {
                    returnedMetadata = JSON.parse(returnedMetadata);
                  } catch (e) {
                    returnedMetadata = {};
                  }
                }
                console.error(`[AUTH] ✅ Returned identity ID: ${returnedRow.id}`);
                console.error(`[AUTH] ✅ Returned metadata: ${JSON.stringify(returnedMetadata)}`);
                console.error(`[AUTH] ✅ Has referral_code_id: ${!!returnedMetadata.referral_code_id}`);
                
                // ✅ VERIFY: If metadata is still empty, force update it
                if (!returnedMetadata.referral_code_id && Object.keys(referralMetadata).length > 0) {
                  console.error(`[AUTH] ⚠️ Metadata missing referral_code_id after insert, forcing update...`);
                  const forceUpdate = await query(
                    `UPDATE customer_identity 
                     SET metadata = $1::jsonb, updated_at = NOW()
                     WHERE id = $2
                     RETURNING metadata`,
                    [metadataJson, returnedRow.id]
                  );
                  if (forceUpdate.rows.length > 0) {
                    let forcedMetadata = forceUpdate.rows[0].metadata || {};
                    if (typeof forcedMetadata === 'string') {
                      try {
                        forcedMetadata = JSON.parse(forcedMetadata);
                      } catch (e) {
                        forcedMetadata = {};
                      }
                    }
                    console.error(`[AUTH] ✅ Force update result: ${JSON.stringify(forcedMetadata)}`);
                  }
                }
              } else {
                console.error(`[AUTH] ❌ CRITICAL: Insert/Update returned 0 rows!`);
              }
              
              const newIdentityArray = insertResult.rows;
              
              if (newIdentityArray && newIdentityArray.length > 0) {
                const newIdentity = newIdentityArray[0];
                
                console.error(`[AUTH] ✅ Query executed successfully!`);
                console.error(`[AUTH] Created customer_identity ID: ${newIdentity.id}`);
                console.error(`[AUTH] Created customer_identity metadata: ${JSON.stringify(newIdentity.metadata || {})}`);
                
                // ✅ APPROACH 21-30: Multiple verification and update strategies
                const { query } = await import('../database/rds-connection');
                
                // Approach 21: Verify identity exists
                const verifyCheck = await query(
                  `SELECT * FROM customer_identity WHERE id = $1`,
                  [newIdentity.id]
                );
                
                if (verifyCheck.rows.length > 0) {
                  let verifiedIdentity = verifyCheck.rows[0];
                  let verifiedMetadata = verifiedIdentity.metadata || {};
                  
                  // Handle string metadata
                  if (typeof verifiedMetadata === 'string') {
                    try {
                      verifiedMetadata = JSON.parse(verifiedMetadata);
                    } catch (e) {
                      verifiedMetadata = {};
                    }
                  }
                  
                  console.error(`[AUTH] ✅ VERIFIED: customer_identity ${newIdentity.id} exists in database`);
                  console.error(`[AUTH] ✅ Verified metadata: ${JSON.stringify(verifiedMetadata, null, 2)}`);
                  
                  // Approach 22-25: If metadata is missing, update it
                  if (!verifiedMetadata.referral_code_id && Object.keys(referralMetadata).length > 0) {
                    console.error(`[AUTH] ⚠️ Metadata missing in DB, updating...`);
                    
                    // Approach 22: Update with object
                    try {
                      await query(
                        `UPDATE customer_identity 
                         SET metadata = $1::jsonb, updated_at = NOW()
                         WHERE id = $2`,
                        [JSON.stringify(referralMetadata), newIdentity.id]
                      );
                      console.error(`[AUTH] ✅ Updated metadata (approach 22)`);
                    } catch (updateError: any) {
                      console.error(`[AUTH] ❌ Update approach 22 failed: ${updateError.message}`);
                      
                      // Approach 23: Update with merge
                      try {
                        await query(
                          `UPDATE customer_identity 
                           SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
                           WHERE id = $2`,
                          [JSON.stringify(referralMetadata), newIdentity.id]
                        );
                        console.error(`[AUTH] ✅ Updated metadata (approach 23 - merge)`);
                      } catch (mergeError: any) {
                        console.error(`[AUTH] ❌ Update approach 23 failed: ${mergeError.message}`);
                      }
                    }
                    
                    // Approach 24: Re-verify after update
                    const reVerify = await query(
                      `SELECT metadata FROM customer_identity WHERE id = $1`,
                      [newIdentity.id]
                    );
                    if (reVerify.rows.length > 0) {
                      let reVerifiedMetadata = reVerify.rows[0].metadata || {};
                      if (typeof reVerifiedMetadata === 'string') {
                        try {
                          reVerifiedMetadata = JSON.parse(reVerifiedMetadata);
                        } catch (e) {
                          reVerifiedMetadata = {};
                        }
                      }
                      console.error(`[AUTH] ✅ Re-verified metadata: ${JSON.stringify(reVerifiedMetadata)}`);
                    }
                  }
                  
                  identityId = newIdentity.id;
                  customerIdentityCreated = true;
                  console.error(`[AUTH] ✅ ✅ ✅ SUCCESS: Created customer_identity ${newIdentity.id} with referral code in metadata ✅ ✅ ✅`);
                  console.error(`[AUTH] ========================================`);
                } else {
                  throw new Error('customer_identity not found after insert');
                }
              } else {
                throw new Error('insert() returned empty array');
              }
            } catch (createError: any) {
              retryCount++;
              console.error(`[AUTH] ========================================`);
              console.error(`[AUTH] ❌ ❌ ❌ CRITICAL ERROR creating customer_identity (Attempt ${retryCount}/${maxRetries}) ❌ ❌ ❌`);
              console.error('[AUTH] Error message:', createError.message);
              console.error('[AUTH] Error code:', createError.code);
              console.error('[AUTH] Error detail:', createError.detail);
              console.error('[AUTH] Error stack:', createError.stack);
              console.error('[AUTH] ========================================');
              
              if (retryCount >= maxRetries) {
                // Last attempt failed - try direct SQL query as fallback
                console.error('[AUTH] All retries failed, attempting direct SQL fallback...');
                try {
                  const { query } = await import('../database/rds-connection');
                  const fallbackResult = await query(
                    `INSERT INTO customer_identity (phone, onboarding_status, metadata) 
                     VALUES ($1, 'PHONE_VERIFIED', $2::jsonb)
                     ON CONFLICT (phone)
                     DO UPDATE SET 
                       metadata = COALESCE(EXCLUDED.metadata, customer_identity.metadata),
                       updated_at = NOW()
                     RETURNING id`,
                    [normalizedPhoneForDb, JSON.stringify(referralMetadata || {})]
                  );
                  if (fallbackResult.rows.length > 0) {
                    identityId = fallbackResult.rows[0].id;
                    customerIdentityCreated = true;
                    console.error(`[AUTH] ✅ Fallback SQL succeeded: customer_identity ${identityId}`);
                  }
                } catch (fallbackError: any) {
                  console.error('[AUTH] ❌ Fallback SQL also failed:', fallbackError.message);
                }
              } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }
          
          if (!customerIdentityCreated) {
            console.error('[AUTH] ⚠️ Failed to create customer_identity after all retries, continuing without it');
          } else if (identityId) {
            // ✅ APPROACH 101-110: Post-creation metadata update (CRITICAL FALLBACK)
            // Even if metadata was set during creation, verify and update if needed
            if (Object.keys(referralMetadata).length > 0) {
              try {
                const { query } = await import('../database/rds-connection');
                
                // Check current metadata
                const currentCheck = await query(
                  `SELECT metadata FROM customer_identity WHERE id = $1`,
                  [identityId]
                );
                
                let currentMetadata: any = {};
                if (currentCheck.rows.length > 0) {
                  currentMetadata = currentCheck.rows[0].metadata || {};
                  if (typeof currentMetadata === 'string') {
                    try {
                      currentMetadata = JSON.parse(currentMetadata);
                    } catch (e) {
                      currentMetadata = {};
                    }
                  }
                }
                
                // If metadata is missing referral info, update it
                if (!currentMetadata.referral_code_id && referralMetadata.referral_code_id) {
                  console.error(`[AUTH] 🔄 Post-creation: Updating metadata for identity ${identityId}`);
                  await query(
                    `UPDATE customer_identity 
                     SET metadata = $1::jsonb, updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify(referralMetadata), identityId]
                  );
                  
                  // Verify update
                  const verifyUpdate = await query(
                    `SELECT metadata FROM customer_identity WHERE id = $1`,
                    [identityId]
                  );
                  if (verifyUpdate.rows.length > 0) {
                    let updatedMetadata = verifyUpdate.rows[0].metadata || {};
                    if (typeof updatedMetadata === 'string') {
                      try {
                        updatedMetadata = JSON.parse(updatedMetadata);
                      } catch (e) {
                        updatedMetadata = {};
                      }
                    }
                    console.error(`[AUTH] ✅ Post-creation update verified: ${JSON.stringify(updatedMetadata)}`);
                  }
                } else {
                  console.error(`[AUTH] ✅ Metadata already set: ${JSON.stringify(currentMetadata)}`);
                }
              } catch (postUpdateError: any) {
                console.error(`[AUTH] ❌ Post-creation update failed: ${postUpdateError.message}`);
              }
            } else {
              // ✅ APPROACH 111-120: Last chance - re-process referral code if metadata is empty
              console.error(`[AUTH] 🔄 Last chance: referralMetadata is empty, re-processing...`);
              if (referralCode && typeof referralCode === 'string' && referralCode.trim().length > 0) {
                const lastChanceMetadata = await processCustomerReferralCode(referralCode, phone);
                if (Object.keys(lastChanceMetadata).length > 0) {
                  referralMetadata = lastChanceMetadata;
                  try {
                    const { query } = await import('../database/rds-connection');
                    await query(
                      `UPDATE customer_identity 
                       SET metadata = $1::jsonb, updated_at = NOW()
                       WHERE id = $2`,
                      [JSON.stringify(referralMetadata), identityId]
                    );
                    console.error(`[AUTH] ✅ Last chance succeeded! Metadata updated: ${JSON.stringify(referralMetadata)}`);
                  } catch (lastChanceError: any) {
                    console.error(`[AUTH] ❌ Last chance update failed: ${lastChanceError.message}`);
                  }
                }
              }
            }
          }
          
          // ✅ CRITICAL: Update customer_identity with referral metadata if it wasn't set during creation
          if (identityId && Object.keys(referralMetadata).length > 0) {
            try {
              const { query } = await import('../database/rds-connection');
              // Check if metadata is already set
              const checkMetadata = await query(
                `SELECT metadata FROM customer_identity WHERE id = $1`,
                [identityId]
              );
              
              if (checkMetadata.rows.length > 0) {
                let existingMetadata = checkMetadata.rows[0].metadata || {};
                if (typeof existingMetadata === 'string') {
                  try {
                    existingMetadata = JSON.parse(existingMetadata);
                  } catch (e) {
                    existingMetadata = {};
                  }
                }
                
                // Only update if referral metadata is missing
                if (!existingMetadata.referral_code_id) {
                  console.error(`[AUTH] ⚠️ Referral metadata missing in customer_identity, updating...`);
                  await query(
                    `UPDATE customer_identity 
                     SET metadata = $1::jsonb, updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify(referralMetadata), identityId]
                  );
                  console.error(`[AUTH] ✅ Updated customer_identity ${identityId} with referral metadata`);
                }
              }
            } catch (updateError: any) {
              console.error('[AUTH] Error updating customer_identity with referral metadata:', updateError);
            }
          }
          
          // Create customer with default full_name (will be updated during profile completion) (with timeout)
          let newCustomers: any[] = [];
          try {
            const insertPromise = insert('customers', {
              phone,
              full_name: `Customer ${phone.slice(-4)}`, // Temporary name until profile is completed
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
            userId = `temp_customer_${phone}_${Date.now()}`;
            userData = {
              id: userId,
              phone,
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

          // Award signup bonus (100 points) - auto-converts to wallet
          try {
            const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
            await loyaltyPointsService.awardPoints({
              customerId: userId,
              actionName: 'signup',
              referenceType: 'signup',
              referenceId: userId,
              description: 'Welcome bonus for signing up',
            });
          } catch (loyaltyError) {
            console.error('Error awarding signup bonus:', loyaltyError);
            // Don't fail signup if loyalty points fail
          }
        }
      } else if (role === 'vendor') {
        console.error(`[AUTH] ========================================`);
        console.error(`[AUTH] 🎯 🎯 🎯 VENDOR ROLE DETECTED - STARTING VENDOR FLOW 🎯 🎯 🎯`);
        console.error(`[AUTH] Phone: ${phone}`);
        console.error(`[AUTH] Referral Code from body: ${referralCode || 'NOT PROVIDED'}`);
        console.error(`[AUTH] ========================================`);
        
        // ✅ FIX: Also fetch vendor_identity to get correct onboarding_status
        // ✅ FIX: Add timeout protection to prevent connection timeouts
        let vendorIdentity: any[] = [];
        let vendors: any[] = [];
        
        // ✅ FIX: Normalize phone for vendor_identity lookup (stores 10-digit format)
        const phoneDigits = phone.replace(/\D/g, '');
        let normalizedPhoneForDb = phoneDigits.length > 10 
          ? phoneDigits.slice(-10)  
          : phoneDigits.length === 9 
            ? '0' + phoneDigits      
            : phoneDigits;
        
        console.log(`[AUTH] 🔍 Vendor lookup - original phone: ${phone}, normalized for DB: ${normalizedPhoneForDb}`);
        
        try {
          const vendorQueriesPromise = Promise.all([
            select('vendor_identity', { phone: normalizedPhoneForDb }),
            select('vendor_identity', { phone: phone }), // Fallback to original format
            select('vendors', { phone })
          ]);
          
          const vendorQueriesTimeout = new Promise<[any[], any[]]>((_, reject) => 
            setTimeout(() => reject(new Error('Vendor queries timeout')), 5000)
          );
          
          const [vendorIdentityByNormalized, vendorIdentityByOriginal, vendors] = await Promise.race([
            vendorQueriesPromise,
            vendorQueriesTimeout
          ]);
          
          // Use first non-empty result
          vendorIdentity = vendorIdentityByNormalized.length > 0 ? vendorIdentityByNormalized : vendorIdentityByOriginal;
          
          console.error(`[AUTH] 🔍 Vendor lookup results - vendor_identity (normalized): ${vendorIdentityByNormalized.length}, vendor_identity (original): ${vendorIdentityByOriginal.length}, vendors: ${vendors.length}`);
        } catch (vendorQueryError: any) {
          console.error('[AUTH] ❌ Vendor queries timed out or failed:', vendorQueryError.message);
          // Continue with empty arrays - will create temp vendor ID
          vendorIdentity = [];
          vendors = [];
        }
        
        console.error(`[AUTH] 🔍 DECISION POINT: vendors.length=${vendors.length}, vendorIdentity.length=${vendorIdentity.length}`);
        
        if (vendors.length > 0) {
          console.error(`[AUTH] 🔍 Taking vendors.length > 0 path`);
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
          console.error(`[AUTH] 🔍 Taking vendorIdentity.length > 0 path`);
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
              // Use the actual vendor record
              userId = vendorsByVendorId[0].id;
              userData = vendorsByVendorId[0];
              userData.onboarding_status = identity.onboarding_status;
              userData.vendor_identity_id = identity.id;
              console.log(`[AUTH] Vendor found via vendor_identity.vendor_id: ${userId}, status: ${identity.onboarding_status}`);
            } else {
              // vendor_id points to non-existent vendor - use identity ID
              userId = identity.id;
              userData = {
                id: identity.id,
                phone: phone,
                is_active: false,
                onboarding_status: identity.onboarding_status,
                vendor_identity_id: identity.id,
                created_at: identity.created_at,
              };
              console.log(`[AUTH] vendor_identity.vendor_id points to missing vendor, using identity ID: ${userId}`);
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
          // ✅ NEW: Create vendor_identity immediately with referral code in metadata
          console.error(`[AUTH] ========================================`);
          console.error(`[AUTH] ⚠️  ⚠️  ⚠️  ELSE BLOCK REACHED - NO VENDOR_IDENTITY FOUND ⚠️  ⚠️  ⚠️`);
          console.error(`[AUTH] Phone: ${phone}`);
          console.error(`[AUTH] Referral Code: ${referralCode || 'NOT PROVIDED'}`);
          console.error(`[AUTH] Referral Code Type: ${typeof referralCode}`);
            console.error(`[AUTH] Vendors length: ${vendors.length}`);
            console.error(`[AUTH] VendorIdentity length: ${vendorIdentity.length}`);
            console.error(`[AUTH] About to process referral and create vendor_identity...`);
            console.error(`[AUTH] ========================================`);
            
            let referralMetadata: any = {};
            let normalizedPhoneForDb = phone.replace(/\D/g, '');
            if (normalizedPhoneForDb.length > 10) {
              normalizedPhoneForDb = normalizedPhoneForDb.slice(-10);
            } else if (normalizedPhoneForDb.length === 9) {
              normalizedPhoneForDb = '0' + normalizedPhoneForDb;
            }
            
            console.error(`[AUTH] Normalized phone for DB: ${normalizedPhoneForDb}`);
          
          // Process referral code if provided
          if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
            try {
              const trimmedCode = referralCode.trim().toUpperCase();
              console.log(`[AUTH] 🔍 Processing referral code for new vendor: ${trimmedCode}`);
              
              const fullPhoneForComparison = `+91${normalizedPhoneForDb}`;
              
              // Check if referral record already exists
              const existingReferral = await query(
                `SELECT * FROM vendor_referrals 
                 WHERE referral_code = $1 
                 AND referred_phone = $2
                 LIMIT 1`,
                [trimmedCode, fullPhoneForComparison]
              );
              
              let referralRecord: any;
              
              if (existingReferral.rows.length > 0) {
                referralRecord = existingReferral.rows[0];
                console.log(`[AUTH] ✅ Found existing referral record ${referralRecord.id}`);
              } else {
                // Find referrer vendor ID
                const codeLookup = await query(
                  `SELECT DISTINCT referrer_vendor_id FROM vendor_referrals 
                   WHERE referral_code = $1 
                   LIMIT 1`,
                  [trimmedCode]
                );
                
                if (codeLookup.rows.length > 0) {
                  const referrerVendorId = codeLookup.rows[0].referrer_vendor_id;
                  
                  // Create new referral record
                  const newReferral = await query(
                    `INSERT INTO vendor_referrals 
                     (referrer_vendor_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
                     VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
                     ON CONFLICT (referrer_vendor_id, referred_phone) 
                     DO UPDATE SET 
                       referral_code = EXCLUDED.referral_code,
                       status = 'applied',
                       applied_at = NOW(),
                       updated_at = NOW()
                     RETURNING *`,
                    [referrerVendorId, trimmedCode, fullPhoneForComparison]
                  );
                  
                  referralRecord = newReferral.rows[0];
                  console.log(`[AUTH] ✅ Created referral record ${referralRecord.id}`);
                } else {
                  console.warn(`[AUTH] ⚠️ Referral code ${trimmedCode} not found`);
                }
              }
              
              if (referralRecord) {
                referralMetadata = {
                  referral_code_id: referralRecord.id,
                  referrer_vendor_id: referralRecord.referrer_vendor_id,
                  referral_code: trimmedCode,
                };
                console.log(`[AUTH] ✅ Referral metadata: ${JSON.stringify(referralMetadata)}`);
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ Error processing referral code:', refError);
            }
          }
          
          // ✅ CRITICAL FIX: Create vendor_identity with referral in metadata
          // Use retry logic and better error handling
          let vendorIdentityCreated = false;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!vendorIdentityCreated && retryCount < maxRetries) {
            try {
              console.error(`[AUTH] ========================================`);
              console.error(`[AUTH] 🚀 🚀 🚀 STARTING VENDOR_IDENTITY CREATION (Attempt ${retryCount + 1}/${maxRetries}) 🚀 🚀 🚀`);
              console.log(`[AUTH] Phone for DB: ${normalizedPhoneForDb}`);
              console.log(`[AUTH] Referral Metadata: ${JSON.stringify(referralMetadata)}`);
              console.log(`[AUTH] ========================================`);
              
              const insertData: any = {
                phone: normalizedPhoneForDb,
                onboarding_status: 'INIT',
              };
              
              if (Object.keys(referralMetadata).length > 0) {
                // ✅ FIX: insert() function handles JSONB automatically, but we can pass as object or string
                // Pass as object - insert() will serialize it
                insertData.metadata = referralMetadata;
                console.error(`[AUTH] ✅ Adding referral metadata: ${JSON.stringify(referralMetadata)}`);
              } else {
                console.error(`[AUTH] ⚠️  No referral metadata to add`);
              }
              
              console.error(`[AUTH] Insert data: ${JSON.stringify(insertData)}`);
              
              // ✅ FIX: Use insert() with proper metadata format
              const newIdentityArray = await insert('vendor_identity', insertData);
              
              if (newIdentityArray && newIdentityArray.length > 0) {
                const newIdentity = newIdentityArray[0];
                
                console.log(`[AUTH] ✅ Query executed successfully!`);
                console.log(`[AUTH] Created vendor_identity ID: ${newIdentity.id}`);
                console.log(`[AUTH] Created vendor_identity metadata: ${JSON.stringify(newIdentity.metadata || {})}`);
                
                // ✅ VERIFY: Double-check that vendor_identity was actually created
                const { query } = await import('../../database/rds-connection');
                const verifyCheck = await query(
                  `SELECT * FROM vendor_identity WHERE id = $1`,
                  [newIdentity.id]
                );
                if (verifyCheck.rows.length > 0) {
                  console.log(`[AUTH] ✅ VERIFIED: vendor_identity ${newIdentity.id} exists in database`);
                  const verifiedMetadata = verifyCheck.rows[0].metadata || {};
                  console.log(`[AUTH] ✅ Verified metadata: ${JSON.stringify(verifiedMetadata, null, 2)}`);
                  
                  userId = newIdentity.id;
                  userData = {
                    id: newIdentity.id,
                    phone: phone,
                    is_active: false,
                    onboarding_status: newIdentity.onboarding_status || 'INIT',
                    vendor_identity_id: newIdentity.id,
                    created_at: newIdentity.created_at,
                  };
                  
                  vendorIdentityCreated = true;
                  console.error(`[AUTH] ✅ ✅ ✅ SUCCESS: Created vendor_identity ${newIdentity.id} with referral code in metadata ✅ ✅ ✅`);
                  console.error(`[AUTH] ✅ UserId set to: ${userId}`);
                  console.error(`[AUTH] ========================================`);
                } else {
                  throw new Error('vendor_identity not found after insert');
                }
              } else {
                throw new Error('insert() returned empty array');
              }
            } catch (createError: any) {
              retryCount++;
              console.error(`[AUTH] ========================================`);
              console.error(`[AUTH] ❌ ❌ ❌ CRITICAL ERROR creating vendor_identity (Attempt ${retryCount}/${maxRetries}) ❌ ❌ ❌`);
              console.error('[AUTH] Error message:', createError.message);
              console.error('[AUTH] Error code:', createError.code);
              console.error('[AUTH] Error detail:', createError.detail);
              console.error('[AUTH] Error stack:', createError.stack);
              console.error('[AUTH] ========================================');
              
              if (retryCount >= maxRetries) {
                // Last attempt failed - try direct SQL query as fallback
                console.error('[AUTH] All retries failed, attempting direct SQL fallback...');
                try {
                  const { query } = await import('../../database/rds-connection');
                  const fallbackResult = await query(
                    `INSERT INTO vendor_identity (phone, onboarding_status, metadata) 
                     VALUES ($1, 'INIT', $2::jsonb)
                     ON CONFLICT (phone) 
                     DO UPDATE SET onboarding_status = EXCLUDED.onboarding_status, 
                                   metadata = COALESCE(EXCLUDED.metadata, vendor_identity.metadata),
                                   updated_at = NOW()
                     RETURNING *`,
                    [normalizedPhoneForDb, JSON.stringify(Object.keys(referralMetadata).length > 0 ? referralMetadata : {})]
                  );
                  
                  if (fallbackResult.rows && fallbackResult.rows.length > 0) {
                    const newIdentity = fallbackResult.rows[0];
                    userId = newIdentity.id;
                    userData = {
                      id: newIdentity.id,
                      phone: phone,
                      is_active: false,
                      onboarding_status: newIdentity.onboarding_status || 'INIT',
                      vendor_identity_id: newIdentity.id,
                      created_at: newIdentity.created_at,
                    };
                    vendorIdentityCreated = true;
                    console.log(`[AUTH] ✅ FALLBACK SUCCESS: Created vendor_identity ${newIdentity.id} using direct SQL`);
                  }
                } catch (fallbackError: any) {
                  console.error('[AUTH] ❌ FALLBACK CREATION ALSO FAILED:', fallbackError);
                }
                
                // If still failed, use temp ID
                if (!vendorIdentityCreated) {
                  userId = `temp_vendor_${phone}_${Date.now()}`;
                  userData = {
                    id: userId,
                    phone: phone,
                    is_active: false,
                    onboarding_status: 'INIT',
                    created_at: new Date().toISOString(),
                  };
                  console.log(`[AUTH] ⚠️  Using temp vendor ID due to vendor_identity creation failure: ${userId}`);
                }
              } else {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
              }
            }
          }
          
          if (!vendorIdentityCreated) {
            console.error('[AUTH] ❌ CRITICAL: Failed to create vendor_identity after all retries!');
            console.error('[AUTH] ❌ This will cause issues with referral code processing!');
          }
          
          console.log(`[AUTH] New vendor OTP verified for ${phone} - proceeding to onboarding`);
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

      // Get or create Cognito user
      
      let cognitoTokens: CognitoTokens;
      
      if (isUATMode) {
        // UAT MODE: Generate proper JWT tokens (not just strings)
        // Token expiry set to 24h so post-OTP redirect and first API calls succeed (was 60s → caused 401 and redirect back to login)
        console.log(`[AUTH] UAT Mode: Generating JWT tokens for ${phone} (role: ${role})`);
        const { generateUATJWTToken } = await import('../utils/jwt-generator');
        cognitoTokens = await generateUATJWTToken({
          userId,
          phone,
          role: role as 'customer' | 'vendor' | 'admin',
          expiresIn: 24 * 60 * 60, // 24 hours so session persists after OTP redirect
        });
        console.log('[AUTH] UAT Mode: Generated JWT tokens with 24h expiry');
      } else {
        // PRODUCTION MODE: Use Cognito if configured, otherwise fallback to JWT tokens
        const hasCognitoConfig = process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID;
        
        if (!hasCognitoConfig) {
          // ✅ FIX: Fallback to JWT tokens when Cognito is not configured
          console.log(`[AUTH] Production Mode: Cognito not configured, using JWT tokens for ${phone} (role: ${role})`);
          const { generateUATJWTToken } = await import('../utils/jwt-generator');
          cognitoTokens = await generateUATJWTToken({
            userId,
            phone,
            role: role as 'customer' | 'vendor' | 'admin',
            expiresIn: 24 * 60 * 60, // 24 hours
          });
          console.log('[AUTH] Production Mode: Generated JWT tokens (Cognito not configured)');
        } else {
          // PRODUCTION MODE: Use full Cognito authentication
          try {
            console.log(`[AUTH] Production Mode: Authenticating with Cognito for ${phone} (role: ${role})`);
            console.log(`[DEBUG] COGNITO_USER_POOL_ID: ${process.env.COGNITO_USER_POOL_ID}`);
            console.log(`[DEBUG] COGNITO_CLIENT_ID: ${process.env.COGNITO_CLIENT_ID}`);
            
            // ✅ FIX: Add timeout to Cognito operations to prevent Lambda timeout
            const COGNITO_TIMEOUT_MS = 10000; // 10 seconds timeout for Cognito operations
            
            const cognitoUserPromise = getOrCreateCognitoUser(phone, undefined, role);
            const cognitoUserTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cognito user creation/retrieval timeout')), COGNITO_TIMEOUT_MS)
            );
            const cognitoUser = await Promise.race([cognitoUserPromise, cognitoUserTimeout]);
            console.log(`[DEBUG] Cognito user created/retrieved: ${JSON.stringify(cognitoUser)}`);
            
            const cognitoAuthPromise = authenticateCognitoUser(phone);
            const cognitoAuthTimeout = new Promise<CognitoTokens>((_, reject) => 
              setTimeout(() => reject(new Error('Cognito authentication timeout')), COGNITO_TIMEOUT_MS)
            );
            cognitoTokens = await Promise.race([cognitoAuthPromise, cognitoAuthTimeout]);
            console.log('[AUTH] Production Mode: Cognito authentication successful');
            console.log(`[DEBUG] Cognito tokens received: accessToken=${cognitoTokens.accessToken.substring(0, 20)}...`);
          } catch (cognitoError: any) {
            console.error('[AUTH] Production Mode: Cognito authentication failed:', cognitoError);
            console.error(`[DEBUG] Cognito error details: ${JSON.stringify(cognitoError)}`);
            
            // ✅ FIX: Fallback to JWT tokens if Cognito fails (instead of failing the request)
            console.warn('[AUTH] Falling back to JWT tokens due to Cognito failure');
            const { generateUATJWTToken } = await import('../utils/jwt-generator');
            cognitoTokens = await generateUATJWTToken({
              userId,
              phone,
              role: role as 'customer' | 'vendor' | 'admin',
              expiresIn: 24 * 60 * 60, // 24 hours
            });
            console.log('[AUTH] Production Mode: Generated JWT tokens as fallback');
          }
        }
      }

      // Determine if user is new or existing using state management
      let isNewUser = false;
      if (role === 'customer') {
        const { getCustomerStateForAuth } = await import('../utils/customer-state');
        const customerState = await getCustomerStateForAuth(userId);
        isNewUser = customerState === 'new';
      } else if (role === 'vendor') {
        isNewUser = userId.startsWith('temp_vendor_') || !userData.id || !userData.created_at || 
                    (userData.onboarding_status && ['INIT', 'ROLE_PENDING'].includes(userData.onboarding_status));
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
            is_active: userData.is_active !== false,
            created_at: userData.created_at || new Date().toISOString(),
          },
          state: isNewUser ? 'new' : 'existing',
          profile: role === 'customer' ? {
            id: userId,
            phone,
            full_name: userData.full_name || null,
            email: userData.email || null,
          } : role === 'vendor' ? {
            id: userId.startsWith('temp_vendor_') ? null : userId,
            phone,
            business_name: userData.business_name || null,
            status: userData.status || 'pending',
            onboarding_status: userData.onboarding_status || 'INIT',
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
    
    // ✅ APPROACH 71-80: Log and preserve referral code from body
    console.error(`[CREATE-EVENT] ========================================`);
    console.error(`[CREATE-EVENT] Body parsed from Hono request`);
    console.error(`[CREATE-EVENT] Body keys: ${Object.keys(body).join(', ')}`);
    console.error(`[CREATE-EVENT] referralCode in body: ${body.referralCode || 'NOT FOUND'}`);
    console.error(`[CREATE-EVENT] referral_code in body: ${body.referral_code || 'NOT FOUND'}`);
    console.error(`[CREATE-EVENT] Full body: ${JSON.stringify(body).substring(0, 500)}`);
    console.error(`[CREATE-EVENT] ========================================`);
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
  return {
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1), // Remove leading '?'
    requestContext: {
      http: {
        method: c.req.method || 'POST',
        path: url.pathname,
      },
      requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    },
    headers: headers,
    body: body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
  };
}

function createLambdaContext(): any {
  return {
    awsRequestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}
