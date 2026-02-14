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

    const { phone, otp } = validationResult.data;

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
        isValid = await verifyOtp(phone, otp);
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
      const phoneDigits = phone.replace(/\D/g, '');
      const normalizedPhone = phoneDigits.length > 10 
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9 
          ? '0' + phoneDigits
          : phoneDigits;

      // Get or create customer/vendor
      let role = body.role || 'customer';
      
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
          let identityId: string | undefined;
          try {
            const { createOrUpdateCustomerIdentity } = await import('../utils/customer-state');
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
        } else {
          // Create customer with proper state
          isNewCustomer = true;
          
          // Create customer identity first (with timeout)
          let identityId: string | undefined;
          try {
            const { createOrUpdateCustomerIdentity } = await import('../utils/customer-state');
            const identityPromise = createOrUpdateCustomerIdentity(phone, undefined);
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
        // ✅ FIX: Also fetch vendor_identity to get correct onboarding_status
        // ✅ FIX: Add timeout protection to prevent connection timeouts
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
        } catch (vendorQueryError: any) {
          console.warn('[AUTH] Vendor queries timed out or failed, continuing with minimal data:', vendorQueryError.message);
          // Continue with empty arrays - will create temp vendor ID
          vendorIdentity = [];
          vendors = [];
        }
        
        if (vendors.length > 0) {
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
        // PRODUCTION MODE: Use full Cognito authentication
        try {
          console.log(`[AUTH] Production Mode: Authenticating with Cognito for ${phone} (role: ${role})`);
          const cognitoUser = await getOrCreateCognitoUser(phone, undefined, role);
          cognitoTokens = await authenticateCognitoUser(phone);
          console.log('[AUTH] Production Mode: Cognito authentication successful');
        } catch (cognitoError: any) {
          console.error('[AUTH] Production Mode: Cognito authentication failed:', cognitoError);
          // In production, Cognito failures are critical - fail the request
          return this.error(
            'Authentication service unavailable',
            503,
            'SERVICE_UNAVAILABLE',
            { details: 'Cognito authentication failed' },
            context.requestId
          );
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
