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
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
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

// ============================================================================
// OTP HELPERS
// ============================================================================

async function createOtp(phone: string, code: string, purpose: string = 'login'): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  await insert('otp_tokens', {
    phone,
    code,
    purpose,
    expires_at: expiresAt,
    is_used: false,
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
  
  if (new Date(record.expires_at) < new Date()) {
    return false;
  }

  await query(
    'UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1',
    [record.id]
  );

  return true;
}

async function sendSmsViaSns(phone: string, message: string): Promise<boolean> {
  try {
    const settings = await select('platform_settings', {
      setting_key: 'admin:settings:aws',
    });

    if (settings.length === 0) {
      console.warn('AWS settings not found in database');
      return false;
    }

    const awsConfig = settings[0].setting_value as any;
    const snsTopicArn = awsConfig?.sns?.smsTopicArn || process.env.SNS_SMS_TOPIC_ARN;

    if (!snsTopicArn) {
      console.warn('SNS topic ARN not configured');
      return false;
    }

    const snsClient = new SNSClient({ region: awsConfig?.region || 'ap-south-1' });
    
    await snsClient.send(new PublishCommand({
      TopicArn: snsTopicArn,
      Message: message,
      MessageAttributes: {
        phone: {
          DataType: 'String',
          StringValue: phone,
        },
      },
    }));

    return true;
  } catch (error) {
    console.error('Error sending SMS via SNS:', error);
    return false;
  }
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

    try {
      // Generate OTP - use 123456 in UAT mode, random 6-digit in production
      // Check multiple ways to detect dev/UAT environment
      const isUATMode = process.env.UAT_MODE === 'true' || 
                       process.env.NODE_ENV === 'development' ||
                       process.env.STAGE === 'dev' ||
                       process.env.ENVIRONMENT === 'dev' ||
                       (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.AWS_LAMBDA_FUNCTION_NAME.includes('dev'));
      
      const otpCode = isUATMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
      
      if (isUATMode) {
        console.log(`[AUTH] UAT Mode: Using fixed OTP 123456 for ${phone}`);
      } else {
        console.log(`[AUTH] Production Mode: Generated random OTP for ${phone}`);
      }
      
      // Store OTP (use original phone for storage, normalized for display)
      try {
        await createOtp(phone, otpCode, body.role || 'login');
      } catch (dbError: any) {
        console.error('[AUTH] Database error creating OTP:', dbError);
        console.error('[AUTH] Error details:', JSON.stringify(dbError, null, 2));
        // In UAT environments, continue even if database fails (for testing)
        if (!isUATMode) {
          throw dbError;
        }
        console.warn('[AUTH] UAT Mode: Continuing despite database error - OTP will still work');
      }

      // Send SMS (only in production, not in UAT mode)
      if (!isUATMode) {
        try {
          const message = `Your Warmpawz OTP is ${otpCode}. Valid for 5 minutes.`;
          await sendSmsViaSns(phone, message);
          console.log(`[AUTH] Production Mode: SMS sent to ${phone}`);
        } catch (smsError: any) {
          console.warn('[AUTH] Production Mode: SMS send failed, continuing:', smsError);
          // Don't fail OTP send if SMS fails, but log it
        }
      } else {
        console.log(`[AUTH] UAT Mode: SMS skipped for ${phone} (using fixed OTP 123456)`);
      }

      // Return standardized response
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

    // Check if UAT mode is enabled (check once for the entire function)
    const isUATMode = process.env.UAT_MODE === 'true' || 
                     process.env.NODE_ENV === 'development' ||
                     process.env.STAGE === 'dev' ||
                     (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.AWS_LAMBDA_FUNCTION_NAME.includes('dev'));

    try {
      let isValid = false;
      
      if (isUATMode && otp === '123456') {
        // UAT MODE: Accept 123456 without checking database
        console.log(`[AUTH] UAT Mode: Accepting fixed OTP 123456 for ${phone} (database check skipped)`);
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
          console.warn('[AUTH] UAT Mode: Could not mark existing OTP as used:', e);
        }
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

      // Get or create customer/vendor
      const role = body.role || 'customer';
      let userId: string;
      let userData: any;

      if (role === 'customer') {
        const customers = await select('customers', { phone });
        if (customers.length > 0) {
          userId = customers[0].id;
          userData = customers[0];
        } else {
          // Create customer
          const newCustomers = await insert('customers', {
            phone,
            is_active: true,
          });
          userId = newCustomers[0].id;
          userData = newCustomers[0];

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
        const vendors = await select('vendors', { phone });
        if (vendors.length > 0) {
          userId = vendors[0].id;
          userData = vendors[0];
        } else {
          // Vendor doesn't exist yet - this is OK for new vendor registration
          // OTP verification will succeed and they can proceed to onboarding
          // Generate a temporary user ID for the new vendor
          userId = `temp_vendor_${phone}_${Date.now()}`;
          userData = {
            id: userId,
            phone: phone,
            is_active: false,
            created_at: new Date().toISOString(),
          };
          console.log(`[AUTH] New vendor OTP verified for ${phone} - proceeding to onboarding`);
        }
      } else {
        return this.error('Invalid role', 400, 'VALIDATION_ERROR', undefined, context.requestId);
      }

      // Get or create Cognito user
      
      let cognitoTokens: CognitoTokens;
      
      if (isUATMode) {
        // UAT MODE: Skip Cognito and use temporary tokens for faster testing
        console.log(`[AUTH] UAT Mode: Skipping Cognito authentication for ${phone} (role: ${role})`);
        cognitoTokens = {
          accessToken: `uat_token_${role}_${userId}_${Date.now()}`,
          idToken: `uat_id_${userId}_${Date.now()}`,
          refreshToken: `uat_refresh_${userId}_${Date.now()}`,
          expiresIn: 86400, // 24 hours for UAT mode
        };
        console.log('[AUTH] UAT Mode: Generated temporary tokens (Cognito skipped)');
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

      // Return standardized response
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
            is_active: userData.is_active || true,
            created_at: userData.created_at || new Date().toISOString(),
          },
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
    try {
      const event = await createApiGatewayEvent(c);
      const context = createLambdaContext();
      const result: any = await verifyOtpHandler.execute(event, context);
      const body = JSON.parse(result.body);
      return c.json(body, result.statusCode);
    } catch (error: any) {
      console.error('[AUTH] Error in verify-otp handler:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });
}

async function createApiGatewayEvent(c: any): Promise<any> {
  // Get body from Hono request
  const body = await c.req.json().catch(() => ({}));
  
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
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
  };
}

function createLambdaContext(): any {
  return {
    awsRequestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}

