/**
 * ============================================================================
 * AUTHENTICATION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-core/auth-endpoints.tsx
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
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { query, select, insert } from '../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse, createHandler } from '../handler/base-handler';
import { 
  getOrCreateCognitoUser, 
  authenticateCognitoUser,
  verifyCognitoToken,
  CognitoTokens 
} from '../utils/cognito-client';

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

    const snsClient = new SNSClient({
      region: awsSettings.sns.region || 'ap-south-1',
      credentials: {
        accessKeyId: awsSettings.credentials.accessKeyId,
        secretAccessKey: awsSettings.credentials.secretAccessKey,
      },
    });

    await snsClient.send(
      new PublishCommand({
        PhoneNumber: phone,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
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

    // Check UAT mode
    const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';

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

    // Check UAT mode - accept 123456 without database check
    const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
    
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
      isValid = await verifyOtp(phone, otp);
    }

    if (!isValid) {
      return this.error('Invalid or expired OTP', 401);
    }

    // Create or get Cognito user
    let cognitoUser;
    let tokens: CognitoTokens;
    
    try {
      cognitoUser = await getOrCreateCognitoUser(phone);
      tokens = await authenticateCognitoUser(phone);
    } catch (error) {
      console.error('[AUTH] Cognito integration failed:', error);
      // Fallback: return success without Cognito (for backward compatibility during migration)
      return this.success({
        message: 'OTP verified successfully',
        verified: true,
        phone,
        warning: 'Cognito integration unavailable',
      });
    }

    // Return tokens and user info
    return this.success({
      message: 'OTP verified successfully',
      verified: true,
      phone,
      userId: cognitoUser.sub,
      username: cognitoUser.username,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
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
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'auth-handler',
    functionVersion: '$LATEST',
  };
}

