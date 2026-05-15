/**
 * ============================================================================
 * AUTHENTICATION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * 
 * Endpoints:
 * - POST /auth/send-otp - Send OTP to phone number
 * - POST /auth/verify-otp - Verify OTP and create session
 * - POST /auth/logout - Logout user
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { query, select, insert, update } from '../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse, createHandler } from '../handler/base-handler';
import { 
  getOrCreateCognitoUser, 
  authenticateCognitoUser,
  verifyCognitoToken,
  CognitoTokens 
} from '../utils/cognito-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { createHash, randomBytes } from 'crypto';

// ============================================================================
// OTP REPOSITORY HELPERS
// ============================================================================

interface OtpRecord {
  id: string;
  phone: string;
  code: string;
  purpose: string;
  expires_at: Date;
  is_used: boolean;
  attempts: number;
}

async function createOtp(phone: string, code: string, purpose: string = 'login'): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry

  await insert('otp_tokens', {
    phone,
    code,
    purpose,
    expires_at: expiresAt,
    is_used: false,
    // Note: schema doesn't have 'attempts' field, tracking done separately if needed
  });
}

async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const records = await select('otp_tokens', {
    phone,
    code,
    is_used: false,
  });

  if (records.length === 0) {
    return false;
  }

  const record = records[0];
  
  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    return false;
  }

  // Note: Schema doesn't have attempts field - implement rate limiting separately if needed

  // Mark as used
  await query(
    'UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1',
    [record.id]
  );

  return true;
}

// ============================================================================
// SNS HELPER
// ============================================================================

async function sendSmsViaSns(phone: string, message: string): Promise<boolean> {
  try {
    // Get AWS settings from database
    const settings = await select('platform_settings', {
      setting_key: 'admin:settings:aws',
    });

    if (settings.length === 0) {
      console.warn('AWS settings not found in database');
      return false;
    }

    const awsSettings = settings[0].setting_value;
    
    if (!awsSettings?.sns?.enabled || !awsSettings?.credentials?.accessKeyId) {
      console.warn('SNS not enabled or credentials missing');
      return false;
    }

    const normalizedPhone = (() => {
      const raw = String(phone || '').trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) return `+91${digits}`;
      if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
      if (raw.startsWith('+')) return raw;
      return digits ? `+${digits}` : raw;
    })();

    const snsClient = new SNSClient({
      region: awsSettings.sns.region || 'ap-south-1',
      credentials: {
        accessKeyId: awsSettings.credentials.accessKeyId,
        secretAccessKey: awsSettings.credentials.secretAccessKey,
      },
    });

    // Build message attributes
    const messageAttributes: Record<string, any> = {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
    };

    // Add sender ID if configured (for India DLT compliance)
    if (awsSettings.sns?.smsOriginationNumber) {
      // For alphanumeric sender IDs (6 chars max), use as-is
      // For phone numbers, ensure proper format
      const senderId = awsSettings.sns.smsOriginationNumber.trim();
      if (senderId.length > 0) {
        messageAttributes['AWS.SNS.SMS.SenderID'] = {
          DataType: 'String',
          StringValue: senderId,
        };
      }
    }

    if (awsSettings.sns?.entityId) {
      messageAttributes['AWS.SNS.SMS.EntityId'] = {
        DataType: 'String',
        StringValue: awsSettings.sns.entityId,
      };
    }

    if (awsSettings.sns?.templateId) {
      messageAttributes['AWS.SNS.SMS.TemplateId'] = {
        DataType: 'String',
        StringValue: awsSettings.sns.templateId,
      };
    }

    await snsClient.send(
      new PublishCommand({
        PhoneNumber: normalizedPhone,
        Message: message,
        MessageAttributes: messageAttributes,
      })
    );

    return true;
  } catch (error) {
    console.error('SNS send failed:', error);
    return false;
  }
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

class SendOtpHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone } = body;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    // Check UAT mode - ONLY check UAT_MODE env variable for security
    const UAT_MODE = process.env.UAT_MODE === 'true';

    // Generate 6-digit OTP (or use 123456 for UAT)
    const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`[AUTH] Generating OTP for ${phone}: ${UAT_MODE ? '123456 (UAT Mode)' : otp}`);

    // Store OTP in database
    await createOtp(phone, otp, 'login');

    if (UAT_MODE) {
      // UAT Mode: Skip SMS sending, return OTP
      return this.success({ 
        message: 'OTP generated (UAT Mode)',
        debug_otp: otp,
        uat_mode: true,
      });
    }

    // Production Mode: Send SMS via SNS
    const message = `Your Warmpawz verification code is: ${otp}. Valid for 5 minutes.`;
    const sent = await sendSmsViaSns(phone, message);

    if (sent) {
      return this.success({ message: 'OTP sent via SMS' });
    } else {
      // Fallback: log error but still allow login (for staging environments)
      console.warn('[AUTH] SNS disabled or failed. OTP logged to console only.');
      return this.success({ 
        debug_otp: otp, 
        message: 'OTP sent (Mock Mode)',
        warning: 'SMS sending unavailable',
      });
    }
  }
}

class VerifyOtpHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, otp } = body;

    if (!phone || !otp) {
      return this.error('Phone and OTP are required', 400);
    }

    // ============================================================================
    // PHONE NUMBER NORMALIZATION
    // ============================================================================
    // Normalize phone number for consistent comparison and database lookups
    // Handles various formats: +91 9999999999, 919999999999, 9999999999, etc.
    const normalizePhoneNumber = (phoneNumber: string): string => {
      // Remove all non-digit characters
      const phoneDigits = phoneNumber.replace(/\D/g, '');
      
      // Handle different phone number lengths:
      // - If > 10 digits: take last 10 (removes country code)
      // - If 9 digits: pad with leading 0
      // - If 10 digits: use as-is
      if (phoneDigits.length > 10) {
        return phoneDigits.slice(-10);
      } else if (phoneDigits.length === 9) {
        return '0' + phoneDigits;
      } else {
        return phoneDigits;
      }
    };

    const normalizedPhone = normalizePhoneNumber(phone);

    // ============================================================================
    // OTP VERIFICATION LOGIC
    // ============================================================================
    // Priority order:
    // 1. Test User Bypass (works in PRODUCTION - highest priority)
    // 2. UAT Mode Bypass (only works when UAT_MODE=true)
    // 3. Normal OTP Verification (production flow)
    
    const UAT_MODE = process.env.UAT_MODE === 'true';
    const TEST_USER_PHONE = process.env.TEST_USER_PHONE || '';
    const TEST_USER_OTP = process.env.TEST_USER_OTP || '';
    
    // Check if this is the test user (works in PRODUCTION)
    // Only ONE specific phone number with ONE specific OTP will bypass verification
    const normalizedTestPhone = TEST_USER_PHONE ? normalizePhoneNumber(TEST_USER_PHONE) : '';
    const isTestUser = TEST_USER_PHONE && 
                       TEST_USER_OTP && 
                       normalizedPhone === normalizedTestPhone && 
                       otp === TEST_USER_OTP;
    
    let isValid = false;

    // ============================================================================
    // TEST USER BYPASS (PRODUCTION MODE)
    // ============================================================================
    // This allows ONE specific test phone number with ONE specific OTP to bypass
    // OTP verification in production. This is useful for testing without SMS.
    // Security: Only works for the exact phone + OTP combination from env variables.
    if (isTestUser) {
      console.log(`[AUTH] 🧪 TEST USER: Bypassing OTP verification for test phone ${normalizedPhone} with OTP ${otp}`);
      isValid = true;
      
      // Cleanup: Mark any existing OTP records as used (non-blocking)
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
          console.log(`[AUTH] 🧪 TEST USER: Marked existing OTP record as used`);
        }
      } catch (e) {
        console.warn('[AUTH] 🧪 TEST USER: Could not mark existing OTP as used:', e);
      }
    }
    // ============================================================================
    // UAT MODE BYPASS (DEVELOPMENT/TESTING ONLY)
    // ============================================================================
    // In UAT mode, accept OTP '123456' for any phone number
    // This only works when UAT_MODE=true (disabled in production)
    else if (UAT_MODE && otp === '123456') {
      console.log(`[AUTH] 🔧 UAT MODE: Accepting fixed OTP 123456 for ${phone}`);
      isValid = true;
      
      // Cleanup: Mark any existing OTP records as used (non-blocking)
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
        console.warn('[AUTH] 🔧 UAT MODE: Could not mark existing OTP as used:', e);
      }
    }
    // ============================================================================
    // NORMAL OTP VERIFICATION (PRODUCTION FLOW)
    // ============================================================================
    // For all other cases, verify OTP against database
    // This is the standard production flow for regular users
    else {
      isValid = await verifyOtp(phone, otp);
    }

    // ============================================================================
    // VALIDATION RESULT
    // ============================================================================
    // If OTP verification failed, return error immediately
    if (!isValid) {
      return this.error('Invalid or expired OTP', 401);
    }
    
    console.log(`[AUTH] Normalized phone: ${phone} -> ${normalizedPhone}`);

    // ✅ FIX: Check BOTH vendor_identity AND staff table, prioritize staff if phone belongs to staff
    let vendorIdentity = null;
    let vendorRole = null;
    let staffMember = null;
    
    try {
      // ============================================================================
      // STEP 1: ALWAYS check if phone belongs to staff FIRST
      // ============================================================================
      // This ensures staff login works even if vendor_identity already exists
      console.log(`[AUTH] Checking if phone ${normalizedPhone} belongs to staff...`);
      
      const staffQuery = await query(`
        SELECT id, name, vendor_id, phone, mobile_verified, role
        FROM staff 
        WHERE phone = $1 OR phone = $2
        LIMIT 1
      `, [phone, normalizedPhone]);
      
      if (staffQuery.rows && staffQuery.rows.length > 0) {
        // ============================================================================
        // STAFF LOGIN FLOW - Phone belongs to staff member
        // ============================================================================
        staffMember = staffQuery.rows[0];
        const staffVendorId = staffMember.vendor_id;
        const staffRoleName = staffMember.role;
        
        console.log(`[AUTH] ✅ Phone ${phone} belongs to STAFF member ${staffMember.id}, vendor_id: ${staffVendorId}, role: ${staffRoleName}`);
        
        if (staffVendorId) {
          // Verify vendor exists and is NOT solo (business rule for staff)
          try {
            const vendorQuery = await query(`
              SELECT id, business_name, phone as vendor_phone, role_id
              FROM vendors 
              WHERE id = $1::uuid
              LIMIT 1
            `, [staffVendorId]);
            
            if (vendorQuery.rows && vendorQuery.rows.length === 0) {
              console.error(`[AUTH] Staff member ${staffMember.id} has invalid vendor_id: ${staffVendorId}`);
            } else if (vendorQuery.rows && vendorQuery.rows.length > 0) {
              const vendor = vendorQuery.rows[0];
              
              // Check vendor_type - must NOT be "solo" (business rule)
              const vendorIdentityForVendor = await query(`
                SELECT vendor_type, onboarding_status
                FROM vendor_identity 
                WHERE vendor_id = $1::uuid
                LIMIT 1
              `, [staffVendorId]);
              
              let vendorType = null;
              if (vendorIdentityForVendor.rows && vendorIdentityForVendor.rows.length > 0) {
                vendorType = vendorIdentityForVendor.rows[0].vendor_type;
              }
              
              // Business rule: Solo vendors cannot have staff
              if (vendorType === 'solo') {
                console.error(`[AUTH] Staff member ${staffMember.id} belongs to solo vendor ${staffVendorId} - solo vendors cannot have staff`);
              } else {
                // Vendor is business/clinic - proceed with staff login
                console.log(`[AUTH] Verified vendor ${staffVendorId} exists and is ${vendorType || 'business'} type (not solo)`);
              
                // Resolve role ID from staff role name
                let resolvedRoleId = null;
                if (staffRoleName) {
                  try {
                    const roleQuery = await query(`
                      SELECT id, name, display_name 
                      FROM roles 
                      WHERE (name = $1 OR display_name = $1 OR LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1))
                        AND is_active = true
                      LIMIT 1
                    `, [staffRoleName]);
                    
                    if (roleQuery.rows && roleQuery.rows.length > 0) {
                      resolvedRoleId = roleQuery.rows[0].id;
                      vendorRole = roleQuery.rows[0];
                      console.log(`[AUTH] Resolved role "${staffRoleName}" to role ID: ${resolvedRoleId}`);
                    }
                  } catch (roleError: any) {
                    console.warn('[AUTH] Error resolving role from staff member:', roleError.message);
                  }
                }
                
                // ✅ FIX: Create/update vendor_identity for staff phone - ALWAYS set to ACTIVATED
                try {
                  // Check which columns exist
                  const viSchemaCheck = await query(`
                    SELECT 
                      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'user_type') as has_user_type,
                      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'metadata') as has_metadata,
                      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'full_name') as has_full_name,
                      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'business_name') as has_business_name
                  `);
                  const viSchema = viSchemaCheck.rows[0] || {};
                  
                  // Check if vendor_identity already exists for this phone
                  const existingCheck = await query('SELECT * FROM vendor_identity WHERE phone = $1', [normalizedPhone]);
                  
                  if (existingCheck.rows.length > 0) {
                    // ✅ UPDATE existing vendor_identity to ACTIVATED for staff
                    vendorIdentity = existingCheck.rows[0];
                    console.log(`[AUTH] Found existing vendor_identity ${vendorIdentity.id} with status ${vendorIdentity.onboarding_status}, updating to ACTIVATED for staff...`);
                    
                    const updateFields: string[] = [
                      'onboarding_status = $1',
                      'vendor_id = $2::uuid',
                      'updated_at = NOW()'
                    ];
                    const updateValues: any[] = ['ACTIVATED', staffVendorId];
                    let paramIndex = 3;
                    
                    if (viSchema.has_user_type) {
                      updateFields.push(`user_type = $${paramIndex}`);
                      updateValues.push('staff');
                      paramIndex++;
                    }
                    
                    if (resolvedRoleId) {
                      updateFields.push(`selected_role_id = $${paramIndex}::uuid`);
                      updateValues.push(resolvedRoleId);
                      paramIndex++;
                    }
                    
                    if (vendorType) {
                      updateFields.push(`vendor_type = $${paramIndex}`);
                      updateValues.push(vendorType);
                      paramIndex++;
                    }
                    
                    if (viSchema.has_business_name && vendor.business_name) {
                      updateFields.push(`business_name = $${paramIndex}`);
                      updateValues.push(vendor.business_name);
                      paramIndex++;
                    }
                    
                    if (viSchema.has_full_name && staffMember.name) {
                      updateFields.push(`full_name = $${paramIndex}`);
                      updateValues.push(staffMember.name);
                      paramIndex++;
                    }
                    
                    if (viSchema.has_metadata) {
                      updateFields.push(`metadata = $${paramIndex}::jsonb`);
                      updateValues.push(JSON.stringify({
                        staff_id: staffMember.id,
                        created_via: 'staff_login',
                      }));
                      paramIndex++;
                    }
                    
                    updateValues.push(vendorIdentity.id);
                    
                    await query(`UPDATE vendor_identity SET ${updateFields.join(', ')} WHERE id = $${paramIndex}::uuid`, updateValues);
                    
                    // Re-fetch to get updated data
                    const updated = await query('SELECT * FROM vendor_identity WHERE id = $1', [vendorIdentity.id]);
                    vendorIdentity = updated.rows[0];
                    console.log(`[AUTH] ✅ Updated vendor_identity ${vendorIdentity.id} to ACTIVATED for staff member ${staffMember.id}`);
                  } else {
                    // Create new vendor_identity for staff
                    console.log(`[AUTH] No vendor_identity found for staff phone ${normalizedPhone}, creating new one with ACTIVATED status...`);
                    
                    const insertFields = ['phone', 'vendor_id', 'onboarding_status'];
                    const insertValues: any[] = [normalizedPhone, staffVendorId, 'ACTIVATED'];
                    
                    if (viSchema.has_user_type) {
                      insertFields.push('user_type');
                      insertValues.push('staff');
                    }
                    
                    if (resolvedRoleId) {
                      insertFields.push('selected_role_id');
                      insertValues.push(resolvedRoleId);
                    }
                    
                    if (vendorType) {
                      insertFields.push('vendor_type');
                      insertValues.push(vendorType);
                    }
                    
                    if (viSchema.has_business_name && vendor.business_name) {
                      insertFields.push('business_name');
                      insertValues.push(vendor.business_name);
                    }
                    
                    if (viSchema.has_full_name && staffMember.name) {
                      insertFields.push('full_name');
                      insertValues.push(staffMember.name);
                    }
                    
                    if (viSchema.has_metadata) {
                      insertFields.push('metadata');
                      insertValues.push(JSON.stringify({
                        staff_id: staffMember.id,
                        created_via: 'staff_login',
                      }));
                    }
                    
                    const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
                    const insertQuery = `INSERT INTO vendor_identity (${insertFields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
                    
                    const result = await query(insertQuery, insertValues);
                    vendorIdentity = result.rows[0];
                    console.log(`[AUTH] ✅ Created vendor_identity ${vendorIdentity.id} for staff phone ${normalizedPhone} with ACTIVATED status`);
                  }
                } catch (createError: any) {
                  console.error('[AUTH] Error creating/updating vendor_identity for staff:', createError.message, createError.stack);
                }
              }
            }
          } catch (vendorError: any) {
            console.error('[AUTH] Error verifying vendor for staff:', vendorError.message);
          }
        }
      } else {
        // ============================================================================
        // STEP 2: NORMAL VENDOR LOGIN FLOW - Phone is NOT staff, check vendor_identity
        // ============================================================================
        console.log(`[AUTH] Phone ${normalizedPhone} is NOT staff, checking vendor_identity for regular vendor login...`);
        
        let identities = await select('vendor_identity', { phone: normalizedPhone });
        if (identities.length === 0 && phone !== normalizedPhone) {
          identities = await select('vendor_identity', { phone });
        }
        
        if (identities.length > 0) {
          vendorIdentity = identities[0];
          console.log(`[AUTH] Found vendor_identity by phone: ${vendorIdentity.id}, status: ${vendorIdentity.onboarding_status}`);
          // ✅ BUSINESS RULE: Regular vendor login - don't modify status
          // This preserves existing vendor business rules
        }
      }
      
      // Fetch role info if vendor has a selected role (and we haven't already fetched it)
      if (vendorIdentity && vendorIdentity.selected_role_id && !vendorRole) {
        const roles = await select('roles', { id: vendorIdentity.selected_role_id, is_active: true });
        if (roles.length > 0) {
          vendorRole = roles[0];
        }
      }
      
      // ✅ CRITICAL FIX: If staff member found, FORCE vendorIdentity.onboarding_status to ACTIVATED
      // This ensures we never return INIT for staff, even if DB update failed
      if (staffMember && vendorIdentity) {
        if (vendorIdentity.onboarding_status !== 'ACTIVATED') {
          console.warn(`[AUTH] ⚠️ Staff member ${staffMember.id} has vendor_identity with status ${vendorIdentity.onboarding_status}, forcing to ACTIVATED`);
          vendorIdentity.onboarding_status = 'ACTIVATED';
        }
      }
      
    } catch (e) {
      console.warn('[AUTH] Could not fetch vendor identity:', e);
    }

    // Create or get Cognito user
    let cognitoUser;
    let tokens: CognitoTokens;
    
    try {
      cognitoUser = await getOrCreateCognitoUser(phone);
      tokens = await authenticateCognitoUser(phone);
    } catch (error) {
      console.error('[AUTH] Cognito integration failed:', error);
      
      // ✅ CRITICAL: Generate fallback accessToken for staff members (and regular vendors)
      // This ensures they can always log in even if Cognito fails
      const generateFallbackToken = (phone: string, userId?: string): string => {
        // Create a session token based on phone, timestamp, and random bytes
        const timestamp = Date.now();
        const random = randomBytes(16).toString('hex');
        const userIdPart = userId || phone;
        const tokenData = `${phone}_${userIdPart}_${timestamp}_${random}`;
        const tokenHash = createHash('sha256').update(tokenData).digest('hex');
        // Return a JWT-like format: base64 encoded payload with hash
        // Use base64 and replace URL-unsafe characters for base64url compatibility
        const payload = Buffer.from(JSON.stringify({
          phone,
          userId: userIdPart,
          timestamp,
          type: 'fallback_session'
        })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        return `fallback_${payload}.${tokenHash.substring(0, 32)}`;
      };
      
      const fallbackUserId = staffMember?.id || vendorIdentity?.id || phone;
      const fallbackAccessToken = generateFallbackToken(phone, fallbackUserId);
      const fallbackIdToken = generateFallbackToken(phone, fallbackUserId);
      const fallbackRefreshToken = generateFallbackToken(phone, `${fallbackUserId}_refresh`);
      
      console.log(`[AUTH] Generated fallback tokens for ${staffMember ? 'staff member' : 'vendor'}: ${phone}`);
      
      // Fallback: return success with generated tokens (for backward compatibility during migration)
      const fallbackData: any = {
        message: 'OTP verified successfully',
        verified: true,
        phone,
        userId: fallbackUserId,
        username: phone,
        accessToken: fallbackAccessToken,
        idToken: fallbackIdToken,
        refreshToken: fallbackRefreshToken,
        expiresIn: 3600, // 1 hour
        warning: 'Cognito integration unavailable - using fallback tokens',
        // ✅ Include vendor profile data even without Cognito
        // ✅ CRITICAL: For staff members, ALWAYS return ACTIVATED status
        profile: vendorIdentity ? {
          id: vendorIdentity.id,
          onboarding_status: staffMember ? 'ACTIVATED' : (vendorIdentity.onboarding_status || 'INIT'), // ✅ FIX: Force ACTIVATED for staff
          roleId: vendorIdentity.selected_role_id,
          role_id: vendorIdentity.selected_role_id,
          vendor_type: vendorIdentity.vendor_type,
          roleName: vendorRole?.display_name || vendorRole?.name,
          // ✅ NEW: Include vendor_id
          vendor_id: vendorIdentity.vendor_id || (staffMember?.vendor_id ? staffMember.vendor_id.toString() : null),
        } : (staffMember && staffMember.vendor_id ? {
          // ✅ NEW: Staff member but no vendor_identity - return minimal profile with vendor_id
          vendor_id: staffMember.vendor_id.toString(),
          onboarding_status: 'ACTIVATED', // ✅ FIX: Use ACTIVATED for staff
        } : null),
        // ✅ CRITICAL: Include token object for frontend compatibility
        token: {
          access_token: fallbackAccessToken,
          id_token: fallbackIdToken,
          refresh_token: fallbackRefreshToken,
          expires_in: 3600
        },
        tokens: {
          accessToken: fallbackAccessToken,
          idToken: fallbackIdToken,
          refreshToken: fallbackRefreshToken,
          expiresIn: 3600
        },
        user: {
          id: fallbackUserId,
          phone: phone,
          username: phone
        }
      };
      
      // ✅ NEW: Add staff info if staff member logged in
      if (staffMember) {
        fallbackData.staff_info = {
          staff_id: staffMember.id,
          staff_name: staffMember.name,
          vendor_id: staffMember.vendor_id?.toString() || null,
        };
        // ✅ CRITICAL: Force ACTIVATED in fallback response for staff
        if (fallbackData.profile) {
          fallbackData.profile.onboarding_status = 'ACTIVATED';
          console.log(`[AUTH] ✅ FORCED onboarding_status to ACTIVATED for staff in fallback response`);
        }
      }
      
      return this.success(fallbackData);
    }

    // Return tokens and user info with vendor profile
    // ✅ NEW: If staff member logged in, include vendor_id in response
    const responseData: any = {
      message: 'OTP verified successfully',
      verified: true,
      phone,
      userId: cognitoUser.sub,
      username: cognitoUser.username,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      // ✅ FIX: Include vendor profile with roleId
      // ✅ CRITICAL: For staff members, ALWAYS return ACTIVATED status
      profile: vendorIdentity ? {
        id: vendorIdentity.id,
        onboarding_status: staffMember ? 'ACTIVATED' : (vendorIdentity.onboarding_status || 'INIT'), // ✅ FIX: Force ACTIVATED for staff
        roleId: vendorIdentity.selected_role_id,
        role_id: vendorIdentity.selected_role_id,
        vendor_type: vendorIdentity.vendor_type,
        roleName: vendorRole?.display_name || vendorRole?.name,
        // ✅ NEW: Include vendor_id if available (from staff lookup or vendor_identity)
        vendor_id: vendorIdentity.vendor_id || (staffMember?.vendor_id ? staffMember.vendor_id.toString() : null),
      } : (staffMember && staffMember.vendor_id ? {
        // ✅ NEW: Staff member but no vendor_identity - return minimal profile with vendor_id
        vendor_id: staffMember.vendor_id.toString(),
        onboarding_status: 'ACTIVATED', // ✅ FIX: Use ACTIVATED, not 'completed'
      } : null),
    };
    
    // ✅ NEW: Add staff info if staff member logged in (for reference, but they're logged in as vendor)
    if (staffMember) {
      responseData.staff_info = {
        staff_id: staffMember.id,
        staff_name: staffMember.name,
        vendor_id: staffMember.vendor_id?.toString() || null,
      };
      console.log(`[AUTH] Staff member ${staffMember.name} (${staffMember.id}) logged in as vendor ${staffMember.vendor_id}`);
      // ✅ CRITICAL: Force ACTIVATED in response for staff (double-check)
      if (responseData.profile) {
        responseData.profile.onboarding_status = 'ACTIVATED';
        console.log(`[AUTH] ✅ FORCED onboarding_status to ACTIVATED for staff in response`);
      }
      // ✅ FIX: Log the final onboarding_status being returned
      console.log(`[AUTH] Final onboarding_status in response: ${responseData.profile?.onboarding_status || 'MISSING'}`);
    }
    
    return this.success(responseData);
  }
}

// ============================================================================
// HONO ROUTER SETUP (for compatibility with existing handler structure)
// ============================================================================

export function registerAuthEndpoints(app: Hono) {
  const sendOtpHandler = new SendOtpHandler();
  const verifyOtpHandler = new VerifyOtpHandler();

  // Primary routes
  app.post('/auth/send-otp', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/auth/verify-otp', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Compatibility aliases (web/mobile clients)
  app.post('/auth/otp/send', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/auth/otp/verify', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Legacy mobile endpoints
  app.post('/otp/generate', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/otp/verify', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Silent token refresh (legacy router; canonical registration is auth-enhanced)
  app.post('/auth/refresh', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { executeAuthRefresh } = await import('../lib/services/auth/auth-token-refresh');
    const refreshToken = typeof (body as any)?.refreshToken === 'string' ? (body as any).refreshToken : '';
    const out = await executeAuthRefresh(refreshToken);
    return c.json(out.body, out.status);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'auth-handler',
    functionVersion: '$LATEST',
  };
}
