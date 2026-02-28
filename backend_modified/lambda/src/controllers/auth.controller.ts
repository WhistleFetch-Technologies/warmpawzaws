/**
 * ============================================================================
 * AUTHENTICATION CONTROLLERS
 * ============================================================================
 * 
 * Extracted from:
 * - endpoints/auth.ts
 * - endpoints/auth-enhanced.ts
 * - endpoints/otp-enhanced.ts
 * - endpoints/customer-password.ts
 * 
 * Date: 2026-01-28
 * Controller extraction migration
 * ============================================================================
 */

import { Context } from 'hono';
import { randomUUID } from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { query, select, insert, update } from '../database/rds-connection';
import { BaseHandler, BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { 
  getOrCreateCognitoUser, 
  authenticateCognitoUser,
  verifyCognitoToken,
  CognitoTokens 
} from '../utils/cognito-client';
import { sendSMS } from '../utils/sms-service';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { createHash, randomBytes } from 'crypto';
import * as crypto from 'crypto';
import { 
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
} from '@warmpawz/api-contracts/auth';
import { getCompletedPayment, getTotalPaidForBooking, resolvePaymentPolicy } from '../utils/payment-policy';

// ============================================================================
// CONSTANTS
// ============================================================================

const JIO_LOGIN_OTP_TEMPLATE_ID = '1207177028377787269';

// ============================================================================
// OTP HELPERS (from auth-enhanced.ts)
// ============================================================================

/**
 * Normalize phone to canonical form for OTP storage/lookup.
 * Ensures "9326977987", "+919326977987", "919326977987" all match.
 * Indian 10-digit numbers: use last 10 digits. Others: digits only.
 */
export function normalizePhoneForOtp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10; // Indian mobile
  }
  return digits || phone;
}

export async function createOtp(phone: string, code: string, purpose: string = 'login'): Promise<void> {
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

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
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
 * Send SMS via SNS (DLT-aware) - from auth-enhanced.ts
 */
export async function sendSmsViaSns(phone: string, message: string): Promise<boolean> {
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
// OTP HELPERS (from auth.ts - legacy)
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

export async function createOtpLegacy(phone: string, code: string, purpose: string = 'login'): Promise<void> {
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

export async function verifyOtpLegacy(phone: string, code: string): Promise<boolean> {
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

export async function sendSmsViaSnsLegacy(phone: string, message: string): Promise<boolean> {
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
// PASSWORD HELPERS (from customer-password.ts)
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derivedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === derivedHash;
}

// ============================================================================
// OTP GENERATION (from otp-enhanced.ts)
// ============================================================================

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// ============================================================================
// HANDLER CLASSES - AUTH.TS (Legacy)
// ============================================================================

export class SendOtpHandler extends BaseHandler {
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
    await createOtpLegacy(phone, otp, 'login');

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
    const sent = await sendSmsViaSnsLegacy(phone, message);

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

export class VerifyOtpHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, otp } = body;

    if (!phone || !otp) {
      return this.error('Phone and OTP are required', 400);
    }

    // Check UAT mode - ONLY check UAT_MODE env variable
    const UAT_MODE = process.env.UAT_MODE === 'true';
    
    let isValid = false;
    if (UAT_MODE && otp === '123456') {
      // In UAT mode, accept 123456 without checking database
      console.log(`[AUTH] UAT MODE: Accepting fixed OTP 123456 for ${phone}`);
      isValid = true;
      // Try to mark any existing OTP as used to clean up
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
        console.warn('[AUTH] Could not mark existing OTP as used:', e);
      }
    } else {
      // Normal verification
      isValid = await verifyOtpLegacy(phone, otp);
    }

    if (!isValid) {
      return this.error('Invalid or expired OTP', 401);
    }

    // ✅ FIX: Normalize phone number (remove non-digits, handle country codes)
    // Phone numbers in database are stored as digits only (10 digits for India)
    const phoneDigits = phone.replace(/\D/g, ''); // Remove all non-digits
    // If phone has country code (11+ digits), take last 10 digits
    // If phone is 9 digits, pad with leading 0 to make it 10 digits (handles cases like "985342940" -> "0985342940")
    let normalizedPhone = phoneDigits.length > 10 
      ? phoneDigits.slice(-10)  // Take last 10 digits if longer
      : phoneDigits.length === 9 
        ? '0' + phoneDigits      // Pad with 0 if 9 digits
        : phoneDigits;            // Use as-is if 10 digits
    
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
// HANDLER CLASSES - AUTH-ENHANCED.TS (Enhanced with Zod validation)
// ============================================================================

export class SendOtpHandlerEnhanced extends BaseHandlerEnhanced {
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

export class VerifyOtpHandlerEnhanced extends BaseHandlerEnhanced {
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
    
    // Extract referralCode from body (optional, not in schema)
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

    const isUATMode = process.env.UAT_MODE === 'true';

    try {
      let isValid = false;
      
      if (isUATMode && otp === '123456') {
        console.log(`[AUTH] UAT Mode: Accepting fixed OTP 123456 for ${phone} (database check skipped)`);
        isValid = true;
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
          new Promise((resolve) => setTimeout(resolve, 2000))
        ]).catch((e) => {
          console.warn('[AUTH] UAT Mode: OTP cleanup timeout or error:', e);
        });
      } else {
        console.log(`[AUTH] Production Mode: Verifying OTP against database for ${phone}`);
        
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
          
          if (verifyError?.message?.includes('timeout')) {
            return this.error(
              'Service temporarily unavailable. Please try again.',
              503,
              'SERVICE_UNAVAILABLE',
              { details: 'OTP verification timeout' },
              context.requestId
            );
          }
          
          console.warn(`[AUTH] Production Mode: Database error during OTP verification, treating as invalid OTP`);
          isValid = false;
        }
      }
      
      if (!isValid) {
        return this.error('Invalid or expired OTP', 401, 'UNAUTHORIZED', undefined, context.requestId);
      }

      const phoneDigits = phone.replace(/\D/g, '');
      const normalizedPhone = phoneDigits.length > 10 
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9 
          ? '0' + phoneDigits
          : phoneDigits;

      let role = body.role || 'customer';
      
      let userId: string;
      let userData: any;

      if (role === 'customer') {
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
          }
          
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
          }
          
          if (identityId && !userData.customer_identity_id) {
            try {
              const linkPromise = update('customers', { id: userId }, { customer_identity_id: identityId });
              const linkTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Link timeout')), 5000)
              );
              await Promise.race([linkPromise, linkTimeout]);
            } catch (linkError: any) {
              console.warn('[AUTH] Could not link customer identity:', linkError.message);
            }
          }
        } else {
          isNewCustomer = true;
          
          if (referralCode) {
            try {
              const { loyaltyRulesInitService } = await import('../lib/services/loyalty-rules-init-service');
              await loyaltyRulesInitService.ensureReferralSignupRule();
            } catch (initError: any) {
              console.warn('[AUTH] Could not initialize loyalty rules:', initError.message);
            }
          }
          
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
          }
          
          let newCustomers: any[] = [];
          try {
            const insertPromise = insert('customers', {
              phone,
              full_name: `Customer ${phone.slice(-4)}`,
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
          
          if (identityId && userId && !userId.startsWith('temp_')) {
            try {
              const linkPromise = update('customer_identity', { id: identityId }, { customer_id: userId });
              const linkTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Link timeout')), 5000)
              );
              await Promise.race([linkPromise, linkTimeout]);
            } catch (linkError: any) {
              console.warn('[AUTH] Could not link customer identity:', linkError.message);
            }
          }

          if (referralCode && userId && !userId.startsWith('temp_')) {
            try {
              const { processReferralSignup } = await import('../lib/services/referral-service');
              const normalizedCode = String(referralCode).trim().toUpperCase();
              console.log(`[AUTH] 🎁 Processing referral code: ${normalizedCode} for customer: ${userId}`);
              
              const startTime = Date.now();
              const referralResult = await processReferralSignup({
                customerId: userId,
                referralCode: normalizedCode,
              });
              const duration = Date.now() - startTime;
              
              console.log(`[AUTH] 🎁 processReferralSignup completed in ${duration}ms`);
              
              if (referralResult.success) {
                console.log(`[AUTH] ✅ Referral code processed: ${normalizedCode} - Referred: ${referralResult.referredPoints}pts, Referrer: ${referralResult.referrerPoints}pts`);
              } else {
                console.warn(`[AUTH] ⚠️ Referral code processing failed: ${referralResult.error}`);
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ Error processing referral code during signup:', refError);
              // Don't fail signup if referral processing fails
            }
          }

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
          }
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
        } catch (vendorQueryError: any) {
          console.warn('[AUTH] Vendor queries timed out or failed, continuing with minimal data:', vendorQueryError.message);
          vendorIdentity = [];
          vendors = [];
        }
        
        if (vendors.length > 0) {
          userId = vendors[0].id;
          userData = vendors[0];
          if (vendorIdentity.length > 0) {
            userData.onboarding_status = vendorIdentity[0].onboarding_status;
            userData.vendor_identity_id = vendorIdentity[0].id;
          }
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
          }
        } else if (vendorIdentity.length > 0) {
          const identity = vendorIdentity[0];
          
          if (identity.vendor_id) {
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
              userId = vendorsByVendorId[0].id;
              userData = vendorsByVendorId[0];
              userData.onboarding_status = identity.onboarding_status;
              userData.vendor_identity_id = identity.id;
              console.log(`[AUTH] Vendor found via vendor_identity.vendor_id: ${userId}, status: ${identity.onboarding_status}`);
            } else {
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
          userId = `temp_vendor_${phone}_${Date.now()}`;
          userData = {
            id: userId,
            phone: phone,
            is_active: false,
            onboarding_status: 'INIT',
            created_at: new Date().toISOString(),
          };
          console.log(`[AUTH] New vendor OTP verified for ${phone} - proceeding to onboarding`);
          
          if (referralCode && normalizedPhone) {
            try {
              console.log(`[AUTH] Processing vendor referral code: ${referralCode} for phone: ${normalizedPhone}`);
              
              const normalizedCode = referralCode.trim().toUpperCase();
              let referralRecords = await query(
                `SELECT * FROM vendor_referrals 
                 WHERE referral_code = $1 AND referred_phone = $2 
                 ORDER BY created_at DESC LIMIT 1`,
                [normalizedCode, normalizedPhone]
              );

              let referralRecord = referralRecords.rows[0];

              if (!referralRecord) {
                const codeRecords = await query(
                  `SELECT * FROM vendor_referrals 
                   WHERE referral_code = $1 
                   ORDER BY created_at DESC LIMIT 1`,
                  [normalizedCode]
                );
                
                if (codeRecords.rows.length > 0) {
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
                console.log(`[AUTH] ✅ Vendor referral record found/created: ${referralRecord.id}`);
                
                if (vendorIdentity.length > 0) {
                  const identity = vendorIdentity[0];
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
                }
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ Error processing vendor referral code:', refError.message);
            }
          }
        }
      } else if (role === 'admin') {
        try {
          const admins = await select('admins', { phone });
          if (admins.length > 0) {
            userId = admins[0].id;
            userData = admins[0];
            try {
              await update('admins', { id: userId }, { 
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              console.log(`[AUTH] Updated last_login_at for admin ${userId}`);
            } catch (updateErr) {
              console.warn(`[AUTH] Could not update admin last_login_at:`, updateErr);
            }
          } else {
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

      let cognitoTokens: CognitoTokens;
      
      if (isUATMode) {
        console.log(`[AUTH] UAT Mode: Generating JWT tokens for ${phone} (role: ${role})`);
        const { generateUATJWTToken } = await import('../utils/jwt-generator');
        cognitoTokens = await generateUATJWTToken({
          userId,
          phone,
          role: role as 'customer' | 'vendor' | 'admin',
          expiresIn: 24 * 60 * 60,
        });
        console.log('[AUTH] UAT Mode: Generated JWT tokens with 24h expiry');
      } else {
        const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID || 
                                  process.env.COGNITO_VENDOR_POOL_ID || 
                                  process.env.COGNITO_CUSTOMER_POOL_ID || 
                                  '';
        
        if (!cognitoUserPoolId) {
          console.warn(`[AUTH] Production Mode: Cognito not configured (no COGNITO_USER_POOL_ID), using JWT tokens as fallback`);
          const { generateUATJWTToken } = await import('../utils/jwt-generator');
          cognitoTokens = await generateUATJWTToken({
            userId,
            phone,
            role: role as 'customer' | 'vendor' | 'admin',
            expiresIn: 24 * 60 * 60,
          });
          console.log('[AUTH] Production Mode: Generated JWT tokens (Cognito fallback)');
        } else {
          try {
            console.log(`[AUTH] Production Mode: Authenticating with Cognito for ${phone} (role: ${role})`);
            
            const COGNITO_TIMEOUT_MS = 8000;
            
            const cognitoAuthPromise = (async () => {
              const cognitoUser = await getOrCreateCognitoUser(phone, undefined, role);
              const tokens = await authenticateCognitoUser(phone);
              return tokens;
            })();
            
            const cognitoTimeout = new Promise<CognitoTokens>((_, reject) => 
              setTimeout(() => reject(new Error('Cognito authentication timeout after 8 seconds')), COGNITO_TIMEOUT_MS)
            );
            
            cognitoTokens = await Promise.race([cognitoAuthPromise, cognitoTimeout]);
            console.log('[AUTH] Production Mode: Cognito authentication successful');
          } catch (cognitoError: any) {
            console.error('[AUTH] Production Mode: Cognito authentication failed:', cognitoError);
            
            console.warn(`[AUTH] Production Mode: Cognito failed, falling back to JWT tokens`);
            try {
              const { generateUATJWTToken } = await import('../utils/jwt-generator');
              cognitoTokens = await generateUATJWTToken({
                userId,
                phone,
                role: role as 'customer' | 'vendor' | 'admin',
                expiresIn: 24 * 60 * 60,
              });
              console.log('[AUTH] Production Mode: Generated JWT tokens (Cognito fallback after error)');
            } catch (jwtError: any) {
              console.error('[AUTH] Production Mode: JWT fallback also failed:', jwtError);
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

      let isNewUser = false;
      if (role === 'customer') {
        const { getCustomerStateForAuth } = await import('../utils/customer-state');
        const customerState = await getCustomerStateForAuth(userId);
        isNewUser = customerState === 'new';
      } else if (role === 'vendor') {
        isNewUser = userId.startsWith('temp_vendor_') || !userData.id || !userData.created_at || 
                    (userData.onboarding_status && ['INIT', 'ROLE_PENDING'].includes(userData.onboarding_status));
      }

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
// HANDLER CLASSES - CUSTOMER-PASSWORD.TS
// ============================================================================

export class ChangePasswordHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { currentPassword, newPassword, customerId, phone } = body;

    if (!newPassword || newPassword.length < 8) {
      return this.error('New password must be at least 8 characters long', 400);
    }

    if (!currentPassword) {
      return this.error('Current password is required', 400);
    }

    try {
      let customerIdResolved = customerId;
      if (!customerIdResolved && phone) {
        const customers = await select('customers', { phone });
        if (customers.length === 0) {
          return this.error('Customer not found', 404);
        }
        customerIdResolved = customers[0].id;
      }

      if (!customerIdResolved) {
        return this.error('Customer ID or phone is required', 400);
      }

      const customers = await query(
        `SELECT id, password_hash, phone FROM customers WHERE id = $1 OR phone = $1`,
        [customerIdResolved]
      );

      if (customers.rows.length === 0) {
        return this.error('Customer not found', 404);
      }

      const customer = customers.rows[0];

      if (customer.password_hash) {
        const isValid = await comparePassword(currentPassword, customer.password_hash);
        if (!isValid) {
          return this.error('Current password is incorrect', 401);
        }
      }

      const newPasswordHash = await hashPassword(newPassword);

      await query(
        `UPDATE customers SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newPasswordHash, customer.id]
      );

      return this.success({
        message: 'Password changed successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      return this.error(error.message || 'Failed to change password', 500);
    }
  }
}

// ============================================================================
// INLINE HANDLERS - OTP-ENHANCED.TS (Booking OTP handlers)
// ============================================================================

export async function generateBookingOtp(c: Context) {
  try {
    const { bookingId } = c.req.param();
    const { sessionNumber = 1, action = 'start' } = await c.req.json();

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookings[0];

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await insert('otp_tokens', {
      phone: null,
      otp_code: otp,
      otp_type: `booking_${action}`,
      expires_in_minutes: 1440,
      max_attempts: 3,
      metadata: {
        bookingId,
        sessionNumber,
        action,
      },
    });

    const customers = await select('customers', { id: booking.customer_id });
    const customer = customers.length > 0 ? customers[0] : null;

    if (customer?.phone) {
      await sendSMS({
        to: customer.phone,
        message: `Your Warmpawz verification code for booking ${bookingId} (${action}): ${otp}. Valid for 24 hours.`,
        type: 'otp',
      }).catch(err => console.error('SMS send failed:', err));
    }

    return c.json({
      success: true,
      otp,
      generatedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      sentTo: customer?.phone || null,
    });
  } catch (error: any) {
    console.error('Error generating booking OTP:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function verifyBookingOtp(c: Context) {
  try {
    const { bookingId } = c.req.param();
    const { otp, action = 'start', sessionNumber = 1 } = await c.req.json();

    if (!otp || otp.length !== 6) {
      return c.json({ error: 'Invalid OTP format' }, 400);
    }

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const otpTokens = await query(
      `SELECT * FROM otp_tokens
       WHERE metadata->>'bookingId' = $1
         AND metadata->>'action' = $2
         AND metadata->>'sessionNumber' = $3
         AND is_used = false
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [bookingId, action, sessionNumber.toString()]
    ).catch(() => ({ rows: [] }));

    if (otpTokens.rows.length === 0) {
      return c.json({
        error: 'OTP not found',
        message: 'Please generate a new OTP',
      }, 400);
    }

    const otpToken = otpTokens.rows[0];

    if (otpToken.attempts >= otpToken.max_attempts) {
      return c.json({
        error: 'Maximum attempts exceeded',
        message: 'Please generate a new OTP',
      }, 400);
    }

    if (otp !== otpToken.otp_code) {
      await update('otp_tokens',
        { id: otpToken.id },
        { attempts: (otpToken.attempts || 0) + 1 }
      );

      return c.json({
        success: false,
        verified: false,
        message: 'Invalid OTP',
        remainingAttempts: otpToken.max_attempts - ((otpToken.attempts || 0) + 1),
      }, 400);
    }

    await update('otp_tokens',
      { id: otpToken.id },
      {
        is_used: true,
        used_at: new Date().toISOString(),
      }
    );

    if (action === 'end') {
      const totalAmount = parseFloat(bookings[0]?.total_amount || '0') || 0;
      const totalPaid = await getTotalPaidForBooking(bookingId);
      const remainingDue = Math.max(0, totalAmount - totalPaid);

      if (remainingDue > 0.01) {
        try {
          await insert('notifications', {
            recipient_id: bookings[0].customer_id,
            recipient_type: 'customer',
            type: 'payment_due',
            title: 'Payment required to complete appointment',
            message: `Please complete payment of ₹${remainingDue.toFixed(2)} to finish your appointment.`,
            data: JSON.stringify({
              bookingId,
              remainingDue,
              totalAmount,
              totalPaid,
            }),
            is_read: false,
            created_at: new Date(),
          });
        } catch (notifErr) {
          console.warn('Failed to create payment due notification:', notifErr);
        }

        return c.json({
          error: 'Payment required',
          message: 'Please complete payment before ending the appointment.',
          remainingDue,
        }, 402);
      }
    }

    const updateData: any = {};
    if (action === 'start') {
      updateData.status = 'in_progress';
      updateData.started_at = new Date().toISOString();
    } else if (action === 'end') {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length > 0) {
      await update('bookings', { id: bookingId }, updateData);
    }

    return c.json({
      success: true,
      verified: true,
      message: `OTP verified. Session ${action}ed successfully.`,
      booking: {
        id: bookingId,
        status: updateData.status || bookings[0].status,
      },
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function createBookingWithOtp(c: Context) {
  try {
    const body = await c.req.json();
    const {
      customerId,
      vendorId,
      serviceType,
      serviceId,
      staffId,
      scheduledDate,
      scheduledTime,
      petId,
      price,
      notes,
      paymentId,
      razorpayPaymentId,
      razorpayOrderId,
    } = body;

    if (!customerId || !vendorId || !serviceType || !serviceId) {
      return c.json({
        error: 'Customer, vendor, service type, and service ID are required',
      }, 400);
    }

    const vendorRows = await select('vendors', { id: vendorId });
    const vendorType = vendorRows[0]?.category || vendorRows[0]?.vendor_type || vendorRows[0]?.vendorType || null;

    const totalAmount = parseFloat(price || '0');
    const policy = await resolvePaymentPolicy({
      vendorType,
      serviceType,
      totalAmount,
    });

    let paymentRecord: any | null = null;
    let amountPaid = 0;
    if (policy.requiredUpfront > 0) {
      if (!paymentId && !razorpayPaymentId && !razorpayOrderId) {
        return c.json({
          error: 'Payment required before booking creation',
          paymentRequired: true,
          requiredUpfront: policy.requiredUpfront,
          totalAmount,
          policyRule: policy.rule || null,
        }, 402);
      }

      paymentRecord = await getCompletedPayment({
        paymentId,
        razorpayPaymentId,
        razorpayOrderId,
        customerId,
        vendorId,
      });

      if (!paymentRecord) {
        return c.json({
          error: 'Payment not found or not completed',
          paymentRequired: true,
          requiredUpfront: policy.requiredUpfront,
          totalAmount,
        }, 402);
      }

      amountPaid = parseFloat(paymentRecord.amount || '0') || 0;
      if (amountPaid + 0.01 < policy.requiredUpfront) {
        return c.json({
          error: 'Insufficient payment for booking creation',
          paymentRequired: true,
          requiredUpfront: policy.requiredUpfront,
          totalAmount,
          amountPaid,
        }, 402);
      }
    }

    const remainingDue = Math.max(0, totalAmount - amountPaid);
    const paymentStatus = totalAmount === 0
      ? 'paid'
      : remainingDue > 0
        ? 'partial'
        : 'paid';

    const startOTP = generateOTP();
    const endOTP = generateOTP();

    const initialStatus = 'pending';

    const booking = await insert('bookings', {
      customer_id: customerId,
      vendor_id: vendorId,
      service_id: serviceId,
      staff_id: staffId || null,
      booking_date: scheduledDate,
      booking_time: scheduledTime,
      status: initialStatus,
      service_type: serviceType,
      base_price: totalAmount,
      total_amount: totalAmount,
      payment_status: paymentStatus,
      payment_id: paymentRecord?.id || null,
      notes: notes || null,
      otp_code: startOTP,
      otp_verified: false,
    });

    if (paymentRecord?.id) {
      await update('payments', { id: paymentRecord.id }, {
        booking_id: booking[0].id,
        updated_at: new Date().toISOString(),
      });
    }

    await insert('otp_tokens', {
      phone: null,
      otp_code: endOTP,
      otp_type: 'booking_end',
      expires_in_minutes: 1440,
      max_attempts: 3,
      metadata: {
        bookingId: booking[0].id,
        action: 'end',
      },
    });

    const customers = await select('customers', { id: customerId });
    const customer = customers.length > 0 ? customers[0] : null;

    if (customer?.phone) {
      // Note: getSnsClient and PublishCommand are not imported in otp-enhanced.ts
      // This will need to be fixed - for now using sendSMS utility
      await sendSMS({
        to: customer.phone,
        message: `Your Warmpawz booking ${booking[0].id} is confirmed! Start OTP: ${startOTP}, End OTP: ${endOTP}. Save these for verification.`,
        type: 'otp',
      }).catch(err => console.error('SMS send failed:', err));
    }

    return c.json({
      success: true,
      booking: booking[0],
      otps: {
        start: startOTP,
        end: endOTP,
      },
      message: 'Booking created successfully. Save your OTPs for service verification.',
    });
  } catch (error: any) {
    console.error('Error creating booking with OTP:', error);
    return c.json({ error: error.message }, 500);
  }
}

// ============================================================================
// HELPER FUNCTIONS - API Gateway Event Creation (used by endpoint wrappers)
// ============================================================================

export function createApiGatewayEvent(req: any): any {
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

export function createApiGatewayEventWithBody(req: any, parsedBody: any): any {
  return {
    pathParameters: {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: parsedBody ? JSON.stringify(parsedBody) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

export function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'auth-handler',
    functionVersion: '$LATEST',
  };
}

export async function createApiGatewayEventFromHono(c: any, bodyParser?: () => Promise<any>): Promise<any> {
  let body: any = {};
  try {
    if (bodyParser) {
      body = await bodyParser();
    } else {
      body = await Promise.race([
        c.req.json(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Body parsing timeout')), 5000)
        )
      ]);
    }
    if (body?.referralCode || body?.pendingReferralCode) {
      console.log(`[AUTH] ✅ Referral code found in parsed body: ${body.referralCode || body.pendingReferralCode}`);
    }
  } catch (error: any) {
    console.warn('[AUTH] Error parsing request body, using empty object:', error?.message);
    body = {};
  }
  
  const headers: Record<string, string> = {};
  try {
    if (c.req.raw && c.req.raw.headers) {
      const rawHeaders = c.req.raw.headers;
      for (const key in rawHeaders) {
        const value = rawHeaders[key];
        if (value) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
      }
    } else {
      const contentType = c.req.header('content-type');
      const authorization = c.req.header('authorization');
      if (contentType) headers['content-type'] = contentType;
      if (authorization) headers['authorization'] = authorization;
    }
  } catch (e) {
    console.warn('[AUTH] Error processing headers:', e);
  }

  const url = new URL(c.req.url);
  const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;
  if (body?.referralCode || body?.pendingReferralCode) {
    console.log(`[AUTH] ✅ Body stringified with referral code: ${bodyString?.substring(0, 200)}`);
  }
  return {
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1),
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
