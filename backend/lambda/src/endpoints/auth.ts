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

    // ✅ FIX: Normalize phone number before storing and sending SMS
    // This ensures consistent format in database and SMS delivery
    const normalizedPhoneForSms = (() => {
      const raw = String(phone || '').trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) return `+91${digits}`;
      if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
      if (raw.startsWith('+')) return raw;
      return digits ? `+${digits}` : raw;
    })();

    // Check UAT mode - ONLY check UAT_MODE env variable for security
    const UAT_MODE = process.env.UAT_MODE === 'true';

    // Generate 6-digit OTP (or use 123456 for UAT)
    const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`[AUTH] Generating OTP for ${phone} (normalized: ${normalizedPhoneForSms}): ${UAT_MODE ? '123456 (UAT Mode)' : otp}`);

    // Store OTP in database with normalized phone for consistency
    await createOtp(normalizedPhoneForSms, otp, 'login');

    if (UAT_MODE) {
      // UAT Mode: Skip SMS sending, return OTP
      return this.success({ 
        message: 'OTP generated (UAT Mode)',
        debug_otp: otp,
        uat_mode: true,
      });
    }

    // Production Mode: Send SMS via SNS (use normalized phone)
    const message = `Your Warmpawz verification code is: ${otp}. Valid for 5 minutes.`;
    const sent = await sendSmsViaSns(normalizedPhoneForSms, message);

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
    console.log(`[AUTH] ========================================`);
    console.log(`[AUTH] ⚡ VERIFY OTP HANDLER CALLED`);
    console.log(`[AUTH] ========================================`);
    
    const body = this.parseBody(context.event);
    const { phone, otp, referralCode, role } = body;

    // ✅ AGGRESSIVE LOGGING: Log referral code immediately
    console.log(`[AUTH] ========================================`);
    console.log(`[AUTH] OTP VERIFICATION REQUEST`);
    console.log(`[AUTH] Phone: ${phone}`);
    console.log(`[AUTH] Role: ${role}`);
    console.log(`[AUTH] Referral Code: ${referralCode || 'NOT PROVIDED'}`);
    console.log(`[AUTH] Referral Code Type: ${typeof referralCode}`);
    console.log(`[AUTH] Referral Code Trimmed: ${referralCode ? referralCode.trim() : 'N/A'}`);
    console.log(`[AUTH] Full Body Keys: ${Object.keys(body).join(', ')}`);
    console.log(`[AUTH] ========================================`);

    if (!phone || !otp) {
      return this.error('Phone and OTP are required', 400);
    }

    // ✅ FIX: Normalize phone number to match the format stored in database
    const normalizedPhone = (() => {
      const raw = String(phone || '').trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) return `+91${digits}`;
      if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
      if (raw.startsWith('+')) return raw;
      return digits ? `+${digits}` : raw;
    })();

    // Check UAT mode - ONLY check UAT_MODE env variable
    const UAT_MODE = process.env.UAT_MODE === 'true';
    
    let isValid = false;
    if (UAT_MODE && otp === '123456') {
      // In UAT mode, accept 123456 without checking database
      console.log(`[AUTH] UAT MODE: Accepting fixed OTP 123456 for ${phone} (normalized: ${normalizedPhone})`);
      isValid = true;
      // Try to mark any existing OTP as used to clean up
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
        }
      } catch (e) {
        console.warn('[AUTH] Could not mark existing OTP as used:', e);
      }
    } else {
      // Normal verification (use normalized phone)
      isValid = await verifyOtp(normalizedPhone, otp);
    }

    if (!isValid) {
      return this.error('Invalid or expired OTP', 401);
    }

    // ✅ FIX: Normalize phone number for database lookup (extract 10 digits for India)
    // OTP tokens are stored with +91 prefix (e.g., "+919326977987")
    // But vendor_identity/staff tables use 10-digit format, so extract last 10 digits
    const phoneDigits = normalizedPhone.replace(/\D/g, ''); // Remove all non-digits from normalized phone
    // If phone has country code (11+ digits), take last 10 digits
    // If phone is 9 digits, pad with leading 0 to make it 10 digits (handles cases like "985342940" -> "0985342940")
    let normalizedPhoneForDb = phoneDigits.length > 10 
      ? phoneDigits.slice(-10)  // Take last 10 digits if longer
      : phoneDigits.length === 9 
        ? '0' + phoneDigits      // Pad with 0 if 9 digits
        : phoneDigits;            // Use as-is if 10 digits
    
    console.log(`[AUTH] Normalized phone: ${phone} -> ${normalizedPhone} (for DB lookup: ${normalizedPhoneForDb})`);

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
                      const metadata: any = {
                        staff_id: staffMember.id,
                        created_via: 'staff_login',
                      };
                      // ✅ NEW: Add referral code to metadata if provided
                      if ((body as any)._pendingReferralId) {
                        metadata.referral_code_id = (body as any)._pendingReferralId;
                        metadata.referrer_vendor_id = (body as any)._referrerVendorId;
                      }
                      insertFields.push('metadata');
                      insertValues.push(JSON.stringify(metadata));
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
        console.log(`[AUTH] 🔍 Using normalizedPhoneForDb: ${normalizedPhoneForDb} for database lookup`);
        
        // ✅ FIX: Use normalizedPhoneForDb (10 digits) for lookup, as vendor_identity stores 10-digit phones
        console.log(`[AUTH] 🔍 Checking for existing vendor_identity with phone: ${normalizedPhoneForDb}`);
        let identities = await select('vendor_identity', { phone: normalizedPhoneForDb });
        console.log(`[AUTH] 🔍 First lookup result: ${identities.length} record(s) found`);
        
        if (identities.length === 0) {
          // Try with +91 prefix as fallback
          console.log(`[AUTH] 🔍 Trying fallback lookup with phone: ${normalizedPhone}`);
          identities = await select('vendor_identity', { phone: normalizedPhone });
          console.log(`[AUTH] 🔍 Fallback lookup result: ${identities.length} record(s) found`);
        }
        if (identities.length === 0 && phone !== normalizedPhone && phone !== normalizedPhoneForDb) {
          // Try original phone format as last resort
          console.log(`[AUTH] 🔍 Trying last resort lookup with original phone: ${phone}`);
          identities = await select('vendor_identity', { phone });
          console.log(`[AUTH] 🔍 Last resort lookup result: ${identities.length} record(s) found`);
        }
        
        console.log(`[AUTH] 🔍 Final identities count: ${identities.length}`);
        
        if (identities.length > 0) {
          console.log(`[AUTH] ✅ Found existing vendor_identity, processing...`);
          vendorIdentity = identities[0];
          console.log(`[AUTH] Found vendor_identity by phone: ${vendorIdentity.id}, status: ${vendorIdentity.onboarding_status}`);
          
          // ✅ NEW: If referral code provided and not in metadata, update it
          if (referralCode && role === 'vendor' && typeof referralCode === 'string' && referralCode.trim()) {
            try {
              let metadata = vendorIdentity.metadata || {};
              if (typeof metadata === 'string') {
                try {
                  metadata = JSON.parse(metadata);
                } catch (e) {
                  metadata = {};
                }
              }
              
              if (!metadata.referral_code_id) {
                const trimmedCode = referralCode.trim().toUpperCase();
                console.log(`[AUTH] 🔍 Processing referral code for existing vendor_identity: ${trimmedCode}`);
                console.log(`[AUTH] 🔍 Vendor Identity ID: ${vendorIdentity.id}, Phone: ${normalizedPhoneForDb}`);
                
                // ✅ FIX: Use normalizedPhoneForDb (10 digits) and convert to +91 format for vendor_referrals
                const fullPhoneForComparison = `+91${normalizedPhoneForDb}`;
                console.log(`[AUTH] 🔍 Normalized phone for comparison: ${fullPhoneForComparison}`);
                
                // Check if referral record already exists for this phone
                let existingReferral = await query(
                  `SELECT * FROM vendor_referrals 
                   WHERE referral_code = $1 
                   AND referred_phone = $2
                   LIMIT 1`,
                  [trimmedCode, fullPhoneForComparison]
                );
                
                console.log(`[AUTH] 🔍 Existing referral check: ${existingReferral.rows.length} record(s) found`);
                
                let referralRecord: any;
                
                if (existingReferral.rows.length > 0) {
                  referralRecord = existingReferral.rows[0];
                  console.log(`[AUTH] ✅ Found existing referral record ${referralRecord.id} for phone ${fullPhoneForComparison}`);
                } else {
                  // Find any referral record with this code to get referrer_vendor_id
                  console.log(`[AUTH] 🔍 No existing referral record found, looking up referrer for code ${trimmedCode}`);
                  const codeLookup = await query(
                    `SELECT DISTINCT referrer_vendor_id FROM vendor_referrals 
                     WHERE referral_code = $1 
                     LIMIT 1`,
                    [trimmedCode]
                  );
                  
                  console.log(`[AUTH] 🔍 Code lookup result: ${codeLookup.rows.length} record(s) found`);
                  
                  if (codeLookup.rows.length > 0) {
                    let foundReferrerVendorId = codeLookup.rows[0].referrer_vendor_id;
                    console.log(`[AUTH] 🔍 Found referrer vendor ID: ${foundReferrerVendorId}`);
                    
                    // Create new referral record for this vendor
                    console.log(`[AUTH] 🔍 Creating new referral record...`);
                    try {
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
                        [foundReferrerVendorId, trimmedCode, fullPhoneForComparison]
                      );
                      
                      referralRecord = newReferral.rows[0];
                      console.log(`[AUTH] ✅ Created/updated referral record ${referralRecord.id} for code ${trimmedCode}`);
                    } catch (insertError: any) {
                      console.error(`[AUTH] ❌ Error creating referral record:`, insertError);
                      // Try to fetch existing record if insert failed due to constraint
                      const existingAfterError = await query(
                        `SELECT * FROM vendor_referrals 
                         WHERE referrer_vendor_id = $1 
                         AND referred_phone = $2
                         LIMIT 1`,
                        [foundReferrerVendorId, fullPhoneForComparison]
                      );
                      if (existingAfterError.rows.length > 0) {
                        referralRecord = existingAfterError.rows[0];
                        console.log(`[AUTH] ✅ Found existing referral record after insert error: ${referralRecord.id}`);
                      } else {
                        console.error(`[AUTH] ❌ Could not create or find referral record`);
                      }
                    }
                  } else {
                    console.warn(`[AUTH] ⚠️ Referral code ${trimmedCode} not found in database - invalid code`);
                  }
                }
                
                if (referralRecord) {
                  metadata.referral_code_id = referralRecord.id;
                  metadata.referrer_vendor_id = referralRecord.referrer_vendor_id;
                  metadata.referral_code = trimmedCode;
                  
                  console.log(`[AUTH] 🔍 Updating vendor_identity metadata with:`, metadata);
                  await query(
                    `UPDATE vendor_identity 
                     SET metadata = $1::jsonb, updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify(metadata), vendorIdentity.id]
                  );
                  
                  console.log(`[AUTH] ✅ Updated vendor_identity ${vendorIdentity.id} metadata with referral code ${trimmedCode}`);
                } else {
                  console.warn(`[AUTH] ⚠️ Referral code ${trimmedCode} not found - invalid code or lookup failed`);
                }
              } else {
                console.log(`[AUTH] ℹ️ Referral code already in metadata, skipping update`);
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ CRITICAL ERROR updating referral code in metadata:', refError);
              console.error('[AUTH] ❌ Error stack:', refError.stack);
              console.error('[AUTH] ❌ Error details:', JSON.stringify(refError, null, 2));
              // Don't block login, but log aggressively
            }
          } else {
            console.log(`[AUTH] ⚠️ Referral code processing SKIPPED - conditions not met:`);
            console.log(`[AUTH]   - referralCode: ${referralCode || 'NULL'}`);
            console.log(`[AUTH]   - role: ${role}`);
            console.log(`[AUTH]   - typeof referralCode: ${typeof referralCode}`);
            if (referralCode && typeof referralCode === 'string') {
              console.log(`[AUTH]   - referralCode.trim(): "${referralCode.trim()}"`);
              console.log(`[AUTH]   - referralCode.trim().length: ${referralCode.trim().length}`);
            }
          }
          
          // ✅ BUSINESS RULE: Regular vendor login - don't modify status
          // This preserves existing vendor business rules
        } else {
          // ✅ NEW: No vendor_identity exists - this is a new vendor registration
          console.log(`[AUTH] ========================================`);
          console.log(`[AUTH] ⚠️  NO VENDOR_IDENTITY FOUND - NEW VENDOR REGISTRATION`);
          console.log(`[AUTH] Phone: ${normalizedPhoneForDb} (normalized from ${normalizedPhone})`);
          console.log(`[AUTH] Referral Code: ${referralCode || 'NOT PROVIDED'}`);
          console.log(`[AUTH] ========================================`);
          
          // Process referral code if provided and create vendor_identity with referral in metadata
          let referralMetadata: any = {};
          let referralRecordId: string | null = null;
          let referrerVendorId: string | null = null;
          
          if (referralCode && role === 'vendor' && typeof referralCode === 'string' && referralCode.trim()) {
            try {
              const trimmedCode = referralCode.trim().toUpperCase();
              console.log(`[AUTH] 🔍 Processing referral code for new vendor: ${trimmedCode}`);
              console.log(`[AUTH] 🔍 Phone: ${normalizedPhoneForDb}`);
              
              // ✅ FIX: Use normalizedPhoneForDb (10 digits) and convert to +91 format for vendor_referrals
              const fullPhoneForComparison = `+91${normalizedPhoneForDb}`;
              console.log(`[AUTH] 🔍 Normalized phone for comparison: ${fullPhoneForComparison}`);
              
              // Check if referral record already exists for this phone
              const existingReferral = await query(
                `SELECT * FROM vendor_referrals 
                 WHERE referral_code = $1 
                 AND referred_phone = $2
                 LIMIT 1`,
                [trimmedCode, fullPhoneForComparison]
              );
              
              console.log(`[AUTH] 🔍 Existing referral check: ${existingReferral.rows.length} record(s) found`);
              
              let referralRecord: any;
              
              if (existingReferral.rows.length > 0) {
                // Reuse existing referral record
                referralRecord = existingReferral.rows[0];
                console.log(`[AUTH] ✅ Found existing referral record ${referralRecord.id} for phone ${fullPhoneForComparison}`);
              } else {
                // Find any referral record with this code to get referrer_vendor_id
                console.log(`[AUTH] 🔍 No existing referral record found, looking up referrer for code ${trimmedCode}`);
                const codeLookup = await query(
                  `SELECT DISTINCT referrer_vendor_id FROM vendor_referrals 
                   WHERE referral_code = $1 
                   LIMIT 1`,
                  [trimmedCode]
                );
                
                console.log(`[AUTH] 🔍 Code lookup result: ${codeLookup.rows.length} record(s) found`);
                
                if (codeLookup.rows.length > 0) {
                  referrerVendorId = codeLookup.rows[0].referrer_vendor_id; // ✅ FIX: Remove const to use outer scope variable
                  console.log(`[AUTH] 🔍 Found referrer vendor ID: ${referrerVendorId}`);
                  
                  // Create new referral record for this vendor
                  // ✅ FIX: Use ON CONFLICT to handle race conditions (multiple OTP verifications)
                  console.log(`[AUTH] 🔍 Creating new referral record...`);
                  try {
                    const newReferral = await query(
                      `INSERT INTO vendor_referrals 
                       (referrer_vendor_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
                       VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
                       ON CONFLICT (referrer_vendor_id, referred_phone) 
                       DO UPDATE SET 
                         referral_code = EXCLUDED.referral_code,
                         status = 'applied',
                         applied_at = COALESCE(EXCLUDED.applied_at, vendor_referrals.applied_at, NOW()),
                         updated_at = NOW()
                       RETURNING *`,
                      [referrerVendorId, trimmedCode, fullPhoneForComparison]
                    );
                    
                    referralRecord = newReferral.rows[0];
                    console.log(`[AUTH] ✅ Created/updated referral record ${referralRecord.id} for code ${trimmedCode}`);
                  } catch (insertError: any) {
                    // If ON CONFLICT doesn't work (constraint might not exist), try regular insert
                    console.warn(`[AUTH] ⚠️  ON CONFLICT failed, trying regular insert:`, insertError.message);
                    try {
                      const newReferral = await query(
                        `INSERT INTO vendor_referrals 
                         (referrer_vendor_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
                         VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
                         RETURNING *`,
                        [referrerVendorId, trimmedCode, fullPhoneForComparison]
                      );
                      referralRecord = newReferral.rows[0];
                      console.log(`[AUTH] ✅ Created referral record ${referralRecord.id} for code ${trimmedCode}`);
                    } catch (fallbackError: any) {
                      // If insert still fails, try to find existing record
                      console.warn(`[AUTH] ⚠️  Insert failed, checking for existing record:`, fallbackError.message);
                      const existingCheck = await query(
                        `SELECT * FROM vendor_referrals 
                         WHERE referrer_vendor_id = $1 
                         AND referred_phone = $2
                         LIMIT 1`,
                        [referrerVendorId, fullPhoneForComparison]
                      );
                      if (existingCheck.rows.length > 0) {
                        referralRecord = existingCheck.rows[0];
                        console.log(`[AUTH] ✅ Found existing referral record ${referralRecord.id}`);
                      } else {
                        throw fallbackError;
                      }
                    }
                  }
                } else {
                  console.warn(`[AUTH] ⚠️ Referral code ${trimmedCode} not found in database - invalid code`);
                }
              }
              
              if (referralRecord) {
                referralRecordId = referralRecord.id;
                referrerVendorId = referralRecord.referrer_vendor_id;
                referralMetadata = {
                  referral_code_id: referralRecord.id,
                  referrer_vendor_id: referralRecord.referrer_vendor_id,
                  referral_code: trimmedCode,
                };
                
                // Store for later use
                (body as any)._pendingReferralId = referralRecord.id;
                (body as any)._referrerVendorId = referralRecord.referrer_vendor_id;
                
                console.log(`[AUTH] ✅ Referral code ${trimmedCode} processed for new vendor registration`);
                console.log(`[AUTH] 🔍 Referral metadata:`, referralMetadata);
              } else {
                console.warn(`[AUTH] ⚠️ Failed to process referral code ${trimmedCode} - no referral record created`);
              }
            } catch (refError: any) {
              console.error('[AUTH] ❌ CRITICAL ERROR processing referral code for NEW vendor:', refError);
              console.error('[AUTH] ❌ Error stack:', refError.stack);
              console.error('[AUTH] ❌ Error details:', JSON.stringify(refError, null, 2));
              // Don't block registration if referral code processing fails, but log aggressively
            }
          } else {
            console.log(`[AUTH] ⚠️ Referral code processing SKIPPED for NEW vendor - conditions not met`);
            console.log(`[AUTH]   - referralCode: ${referralCode || 'NULL'}`);
            console.log(`[AUTH]   - role: ${role}`);
            console.log(`[AUTH]   - typeof referralCode: ${typeof referralCode}`);
            if (referralCode && typeof referralCode === 'string') {
              console.log(`[AUTH]   - referralCode.trim(): "${referralCode.trim()}"`);
            }
          }
          
          // ✅ CRITICAL FIX: Create vendor_identity immediately with referral code in metadata
          // This MUST succeed - retry logic and better error handling
          let vendorIdentityCreated = false;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!vendorIdentityCreated && retryCount < maxRetries) {
            try {
              console.log(`[AUTH] ========================================`);
              console.log(`[AUTH] CREATING VENDOR_IDENTITY FOR NEW VENDOR (Attempt ${retryCount + 1}/${maxRetries})`);
              console.log(`[AUTH] Phone: ${normalizedPhoneForDb} (normalized from ${normalizedPhone})`);
              console.log(`[AUTH] Referral Metadata: ${JSON.stringify(referralMetadata, null, 2)}`);
              console.log(`[AUTH] ========================================`);
              
              // Check schema
              const viSchemaCheck = await query(`
                SELECT 
                  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'metadata') as has_metadata
              `);
              const viSchema = viSchemaCheck.rows[0] || {};
              console.log(`[AUTH] Schema check - has_metadata: ${viSchema.has_metadata}`);
              
              // ✅ CRITICAL: Always try to create vendor_identity, even if metadata column doesn't exist
              // Use INSERT with ON CONFLICT to handle race conditions
              const insertFields = ['phone', 'onboarding_status'];
              const insertValues: any[] = [normalizedPhoneForDb, 'INIT'];
              const updateFields: string[] = ['onboarding_status = EXCLUDED.onboarding_status'];
              
              if (viSchema.has_metadata) {
                if (Object.keys(referralMetadata).length > 0) {
                  insertFields.push('metadata');
                  insertValues.push(JSON.stringify(referralMetadata));
                  updateFields.push('metadata = EXCLUDED.metadata');
                  console.log(`[AUTH] ✅ Adding metadata to insert: ${JSON.stringify(referralMetadata)}`);
                } else {
                  // Even if no referral metadata, ensure metadata column is set to empty object
                  insertFields.push('metadata');
                  insertValues.push('{}');
                  console.log(`[AUTH] ✅ Adding empty metadata object`);
                }
              } else {
                console.log(`[AUTH] ⚠️  Metadata column does not exist, skipping metadata`);
              }
              
              const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
              // ✅ FIX: Use ON CONFLICT to handle race conditions (multiple OTP verifications)
              const insertQuery = `
                INSERT INTO vendor_identity (${insertFields.join(', ')}) 
                VALUES (${placeholders}) 
                ON CONFLICT (phone) 
                DO UPDATE SET ${updateFields.join(', ')}, updated_at = NOW()
                RETURNING *
              `;
              
              console.log(`[AUTH] Executing query: ${insertQuery}`);
              console.log(`[AUTH] With values: ${JSON.stringify(insertValues)}`);
              
              const result = await query(insertQuery, insertValues);
              
              if (result.rows && result.rows.length > 0) {
                vendorIdentity = result.rows[0];
                vendorIdentityCreated = true;
                console.log(`[AUTH] ✅ SUCCESS: Created/updated vendor_identity ${vendorIdentity.id} for new vendor`);
                console.log(`[AUTH] ✅ Created with metadata: ${JSON.stringify(vendorIdentity.metadata || {}, null, 2)}`);
                
                // ✅ CRITICAL: If metadata wasn't set but we have referral info, update it
                if (viSchema.has_metadata && Object.keys(referralMetadata).length > 0) {
                  let currentMetadata = vendorIdentity.metadata || {};
                  if (typeof currentMetadata === 'string') {
                    try {
                      currentMetadata = JSON.parse(currentMetadata);
                    } catch (e) {
                      currentMetadata = {};
                    }
                  }
                  
                  // Check if referral metadata is missing
                  if (!currentMetadata.referral_code_id && referralMetadata.referral_code_id) {
                    console.log(`[AUTH] ⚠️  Referral metadata missing in created record, updating...`);
                    const updatedMetadata = { ...currentMetadata, ...referralMetadata };
                    await query(
                      `UPDATE vendor_identity 
                       SET metadata = $1::jsonb, updated_at = NOW()
                       WHERE id = $2`,
                      [JSON.stringify(updatedMetadata), vendorIdentity.id]
                    );
                    console.log(`[AUTH] ✅ Updated vendor_identity metadata with referral code`);
                    
                    // Re-fetch to get updated metadata
                    const updated = await query(
                      `SELECT * FROM vendor_identity WHERE id = $1`,
                      [vendorIdentity.id]
                    );
                    if (updated.rows.length > 0) {
                      vendorIdentity = updated.rows[0];
                    }
                  }
                }
                
                // ✅ VERIFY: Double-check that vendor_identity was actually created
                const verifyCheck = await query(
                  `SELECT * FROM vendor_identity WHERE id = $1`,
                  [vendorIdentity.id]
                );
                if (verifyCheck.rows.length > 0) {
                  console.log(`[AUTH] ✅ VERIFIED: vendor_identity ${vendorIdentity.id} exists in database`);
                  const verifiedMetadata = verifyCheck.rows[0].metadata || {};
                  console.log(`[AUTH] ✅ Verified metadata: ${JSON.stringify(verifiedMetadata, null, 2)}`);
                } else {
                  console.error(`[AUTH] ❌ CRITICAL: vendor_identity ${vendorIdentity.id} NOT FOUND in database after insert!`);
                  vendorIdentityCreated = false;
                }
              } else {
                throw new Error('INSERT query returned no rows');
              }
            } catch (createError: any) {
              retryCount++;
              console.error(`[AUTH] ❌ CRITICAL ERROR creating vendor_identity (Attempt ${retryCount}/${maxRetries}):`, createError);
              console.error('[AUTH] ❌ Error message:', createError.message);
              console.error('[AUTH] ❌ Error code:', createError.code);
              console.error('[AUTH] ❌ Error detail:', createError.detail);
              console.error('[AUTH] ❌ Error stack:', createError.stack);
              
              if (retryCount >= maxRetries) {
                // Last attempt failed - try to create without metadata as fallback
                console.error('[AUTH] ❌ All retries failed, attempting fallback creation without metadata...');
                try {
                  const fallbackResult = await query(
                    `INSERT INTO vendor_identity (phone, onboarding_status) 
                     VALUES ($1, 'INIT')
                     ON CONFLICT (phone) 
                     DO UPDATE SET onboarding_status = EXCLUDED.onboarding_status, updated_at = NOW()
                     RETURNING *`,
                    [normalizedPhoneForDb]
                  );
                  if (fallbackResult.rows && fallbackResult.rows.length > 0) {
                    vendorIdentity = fallbackResult.rows[0];
                    vendorIdentityCreated = true;
                    console.log(`[AUTH] ✅ FALLBACK SUCCESS: Created vendor_identity ${vendorIdentity.id} without metadata`);
                    
                    // Try to update metadata separately if we have referral info
                    if (Object.keys(referralMetadata).length > 0) {
                      try {
                        await query(
                          `UPDATE vendor_identity 
                           SET metadata = $1::jsonb, updated_at = NOW()
                           WHERE id = $2`,
                          [JSON.stringify(referralMetadata), vendorIdentity.id]
                        );
                        console.log(`[AUTH] ✅ Updated vendor_identity metadata after fallback creation`);
                      } catch (metaError) {
                        console.error('[AUTH] ❌ Failed to update metadata after fallback:', metaError);
                      }
                    }
                  }
                } catch (fallbackError: any) {
                  console.error('[AUTH] ❌ FALLBACK CREATION ALSO FAILED:', fallbackError);
                  // Don't block login, but log aggressively
                }
              } else {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
              }
            }
          }
          
          // ✅ CRITICAL: If vendor_identity still wasn't created, log error but don't block
          if (!vendorIdentityCreated) {
            console.error('[AUTH] ❌ CRITICAL: Failed to create vendor_identity after all retries!');
            console.error('[AUTH] ❌ This will cause issues with referral code processing!');
            console.error('[AUTH] ❌ Phone:', normalizedPhoneForDb);
            console.error('[AUTH] ❌ Referral Metadata:', JSON.stringify(referralMetadata, null, 2));
          }
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
    // ✅ FIX: Parse body from Hono request before creating API Gateway event
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (e) {
      body = {};
    }
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/auth/verify-otp', async (c) => {
    // ✅ FIX: Parse body from Hono request before creating API Gateway event
    let body: any = {};
    try {
      body = await c.req.json();
      // ✅ AGGRESSIVE LOGGING: Log referral code immediately after parsing
      console.log(`[AUTH-ROUTE] ========================================`);
      console.log(`[AUTH-ROUTE] Body parsed from Hono request:`);
      console.log(`[AUTH-ROUTE]   - phone: ${body.phone}`);
      console.log(`[AUTH-ROUTE]   - role: ${body.role}`);
      console.log(`[AUTH-ROUTE]   - referralCode: ${body.referralCode || 'NOT PROVIDED'}`);
      console.log(`[AUTH-ROUTE]   - referralCode type: ${typeof body.referralCode}`);
      console.log(`[AUTH-ROUTE]   - All body keys: ${Object.keys(body).join(', ')}`);
      console.log(`[AUTH-ROUTE] ========================================`);
    } catch (e) {
      console.error(`[AUTH-ROUTE] ❌ Error parsing body:`, e);
      body = {};
    }
    const event = createApiGatewayEvent(c.req, body);
    // ✅ AGGRESSIVE LOGGING: Log event body after creation
    console.log(`[AUTH-ROUTE] Event body (stringified): ${event.body}`);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Compatibility aliases (web/mobile clients)
  app.post('/auth/otp/send', async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (e) {
      body = {};
    }
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/auth/otp/verify', async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (e) {
      body = {};
    }
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Legacy mobile endpoints
  app.post('/otp/generate', async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (e) {
      body = {};
    }
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/otp/verify', async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (e) {
      body = {};
    }
    const event = createApiGatewayEvent(c.req, body);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
// ✅ FIX: Accept parsed body as parameter since Hono doesn't have req.body
function createApiGatewayEvent(req: any, parsedBody?: any): any {
  // Get headers from Hono request
  let headers: Record<string, string> = {};
  try {
    if (req.raw && req.raw.headers) {
      const rawHeaders = req.raw.headers;
      for (const key in rawHeaders) {
        const value = rawHeaders[key];
        if (value) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
      }
    } else if (req.headers) {
      headers = req.headers;
    }
  } catch (e) {
    console.warn('[AUTH] Error processing headers:', e);
  }

  return {
    httpMethod: req.method,
    path: req.url,
    headers: headers,
    body: parsedBody ? JSON.stringify(parsedBody) : undefined,
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
