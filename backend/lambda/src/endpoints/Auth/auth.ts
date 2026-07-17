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
import { query, select, insert, update } from '../../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse, createHandler } from '../../handler/base-handler';
import { 
  getOrCreateCognitoUser, 
  authenticateCognitoUser,
  verifyCognitoToken,
  CognitoTokens 
} from '../../utils/cognito-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../utils/entity-extractor';
import { isValidUUID } from '../../types/entities';
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

/**
 * ============================================================================
 * VERIFY OTP HANDLER
 * ============================================================================
 * 
 * Handles OTP verification and user authentication flow:
 * 1. Validates phone and OTP input
 * 2. Normalizes phone number format
 * 3. Verifies OTP (with test user and UAT mode bypasses)
 * 4. Finds vendor identity by phone number
 * 5. Generates authentication tokens (Cognito or fallback)
 * 6. Returns user profile and session information
 * 
 * Business Rules:
 * - Test user bypass works in production (single phone + OTP combo)
 * - UAT mode bypass only works when UAT_MODE=true
 * - Regular vendor login preserves existing onboarding status
 * ============================================================================
 */
class VerifyOtpHandler extends BaseHandler {
  /**
   * Main handler method - orchestrates the entire OTP verification flow
   */
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, otp } = body;

    // Validate input
    if (!phone || !otp) {
      return this.error('Phone and OTP are required', 400);
    }

    // Normalize phone number for consistent database lookups
    const normalizedPhone = this.normalizePhoneNumber(phone);
    console.log(`[AUTH] Normalized phone: ${phone} -> ${normalizedPhone}`);

    // Verify OTP code (handles test user, UAT mode, and normal verification)
    const isValid = await this.verifyOtpCode(phone, normalizedPhone, otp);
    if (!isValid) {
      return this.error('Invalid or expired OTP', 401);
    }

    // Find vendor identity and resolve role
    const vendorIdentity = await this.findVendorIdentityByPhone(phone, normalizedPhone);
    const vendorRole = vendorIdentity && vendorIdentity.selected_role_id
      ? await this.resolveVendorRole(vendorIdentity.selected_role_id)
      : null;

    // Generate authentication tokens
    try {
      const cognitoUser = await getOrCreateCognitoUser(phone);
      const tokens = await authenticateCognitoUser(phone);
      
      // Build and return success response with Cognito tokens
      const responseData = this.buildSuccessResponse(
        phone,
        cognitoUser,
        tokens,
        vendorIdentity,
        vendorRole
      );
      
      return this.success(responseData);
    } catch (error) {
      // Cognito failed - use fallback tokens
      console.error('[AUTH] Cognito integration failed:', error);
      const fallbackData = this.buildFallbackResponse(
        phone,
        vendorIdentity,
        vendorRole
      );
      return this.success(fallbackData);
    }
  }

  /**
   * Normalizes phone number to consistent 10-digit format
   * Handles various formats: +91 9999999999, 919999999999, 9999999999, etc.
   */
  private normalizePhoneNumber(phoneNumber: string): string {
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
  }

  /**
   * Verifies OTP code with priority order:
   * 1. Test User Bypass (works in PRODUCTION - highest priority)
   * 2. UAT Mode Bypass (only works when UAT_MODE=true)
   * 3. Normal OTP Verification (production flow)
   */
  private async verifyOtpCode(phone: string, normalizedPhone: string, otp: string): Promise<boolean> {
    const UAT_MODE = process.env.UAT_MODE === 'true';
    const TEST_USER_PHONE = process.env.TEST_USER_PHONE || '';
    const TEST_USER_OTP = process.env.TEST_USER_OTP || '';
    
    // Check if this is the test user (works in PRODUCTION)
    // Only ONE specific phone number with ONE specific OTP will bypass verification
    const normalizedTestPhone = TEST_USER_PHONE ? this.normalizePhoneNumber(TEST_USER_PHONE) : '';
    const isTestUser = TEST_USER_PHONE && 
                       TEST_USER_OTP && 
                       normalizedPhone === normalizedTestPhone && 
                       otp === TEST_USER_OTP;
    
    // TEST USER BYPASS (PRODUCTION MODE)
    if (isTestUser) {
      console.log(`[AUTH] 🧪 TEST USER: Bypassing OTP verification for test phone ${normalizedPhone} with OTP ${otp}`);
      await this.markOtpAsUsed(normalizedPhone);
      return true;
    }
    
    // UAT MODE BYPASS (DEVELOPMENT/TESTING ONLY)
    if (UAT_MODE && otp === '123456') {
      console.log(`[AUTH] 🔧 UAT MODE: Accepting fixed OTP 123456 for ${phone}`);
      await this.markOtpAsUsed(phone);
      return true;
    }
    
    // NORMAL OTP VERIFICATION (PRODUCTION FLOW)
    return await verifyOtp(phone, otp);
  }

  /**
   * Marks existing OTP records as used (non-blocking cleanup)
   */
  private async markOtpAsUsed(phone: string): Promise<void> {
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
        console.log(`[AUTH] Marked existing OTP record as used for ${phone}`);
      }
    } catch (e) {
      console.warn(`[AUTH] Could not mark existing OTP as used for ${phone}:`, e);
    }
  }

  /**
   * Finds vendor identity by phone number
   */
  private async findVendorIdentityByPhone(phone: string, normalizedPhone: string): Promise<any | null> {
    console.log(`[AUTH] Checking vendor_identity for phone: ${normalizedPhone}`);
    
    let identities = await select('vendor_identity', { phone: normalizedPhone });
    if (identities.length === 0 && phone !== normalizedPhone) {
      identities = await select('vendor_identity', { phone });
    }
    
    if (identities.length > 0) {
      const identity = identities[0];
      console.log(`[AUTH] Found vendor_identity by phone: ${identity.id}, status: ${identity.onboarding_status}`);
      return identity;
    }
    
    return null;
  }

  /**
   * Resolves vendor role information from role ID
   */
  private async resolveVendorRole(roleId: string): Promise<any | null> {
    const roles = await select('roles', { id: roleId, is_active: true });
    return roles.length > 0 ? roles[0] : null;
  }

  /**
   * Generates fallback authentication token when Cognito fails
   */
  private generateFallbackToken(phone: string, userId?: string): string {
    const timestamp = Date.now();
    const random = randomBytes(16).toString('hex');
    const userIdPart = userId || phone;
    const tokenData = `${phone}_${userIdPart}_${timestamp}_${random}`;
    const tokenHash = createHash('sha256').update(tokenData).digest('hex');
    
    // Return a JWT-like format: base64 encoded payload with hash
    const payload = Buffer.from(JSON.stringify({
      phone,
      userId: userIdPart,
      timestamp,
      type: 'fallback_session'
    })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    return `fallback_${payload}.${tokenHash.substring(0, 32)}`;
  }

  /**
   * Builds fallback response when Cognito integration fails
   */
  private buildFallbackResponse(
    phone: string,
    vendorIdentity: any | null,
    vendorRole: any | null
  ): any {
    const fallbackUserId = vendorIdentity?.id || phone;
    const fallbackAccessToken = this.generateFallbackToken(phone, fallbackUserId);
    const fallbackIdToken = this.generateFallbackToken(phone, fallbackUserId);
    const fallbackRefreshToken = this.generateFallbackToken(phone, `${fallbackUserId}_refresh`);
    
    console.log(`[AUTH] Generated fallback tokens for vendor: ${phone}`);
    
    const fallbackData: any = {
      message: 'OTP verified successfully',
      verified: true,
      phone,
      userId: fallbackUserId,
      username: phone,
      accessToken: fallbackAccessToken,
      idToken: fallbackIdToken,
      refreshToken: fallbackRefreshToken,
      expiresIn: 3600,
      warning: 'Cognito integration unavailable - using fallback tokens',
      profile: this.buildVendorProfile(vendorIdentity, vendorRole),
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
    
    return fallbackData;
  }

  /**
   * Builds success response with Cognito tokens
   */
  private buildSuccessResponse(
    phone: string,
    cognitoUser: any,
    tokens: CognitoTokens,
    vendorIdentity: any | null,
    vendorRole: any | null
  ): any {
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
      profile: this.buildVendorProfile(vendorIdentity, vendorRole),
    };
    
    return responseData;
  }

  /**
   * Builds vendor profile object from vendor identity and role
   */
  private buildVendorProfile(
    vendorIdentity: any | null,
    vendorRole: any | null
  ): any | null {
    if (vendorIdentity) {
      return {
        id: vendorIdentity.id,
        onboarding_status: vendorIdentity.onboarding_status || 'INIT',
        roleId: vendorIdentity.selected_role_id,
        role_id: vendorIdentity.selected_role_id,
        vendor_type: vendorIdentity.vendor_type,
        roleName: vendorRole?.display_name || vendorRole?.name,
        vendor_id: vendorIdentity.vendor_id,
      };
    }
    
    return null;
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
