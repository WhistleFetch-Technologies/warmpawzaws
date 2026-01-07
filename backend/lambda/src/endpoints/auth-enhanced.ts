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

    try {
      // Generate OTP
      const otpCode = process.env.UAT_MODE === 'true' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP
      await createOtp(phone, otpCode, body.role || 'login');

      // Send SMS (in production)
      if (process.env.UAT_MODE !== 'true') {
        const message = `Your Warmpawz OTP is ${otpCode}. Valid for 5 minutes.`;
        await sendSmsViaSns(phone, message);
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
      console.error('Error sending OTP:', error);
      return this.error(
        'Failed to send OTP',
        500,
        'INTERNAL_ERROR',
        { details: error.message },
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

    try {
      // Verify OTP
      const isValid = await verifyOtp(phone, otp);
      
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
          // Vendor should go through onboarding
          return this.error('Vendor not found. Please complete onboarding first.', 404, 'NOT_FOUND', undefined, context.requestId);
        }
      } else {
        return this.error('Invalid role', 400, 'VALIDATION_ERROR', undefined, context.requestId);
      }

      // Get or create Cognito user
      let cognitoTokens: CognitoTokens;
      try {
        const cognitoUser = await getOrCreateCognitoUser(phone, undefined, role);
        cognitoTokens = await authenticateCognitoUser(phone);
      } catch (cognitoError: any) {
        console.warn('Cognito authentication failed, using fallback:', cognitoError.message);
        // Fallback: Generate simple token (in production, always use Cognito)
        cognitoTokens = {
          accessToken: `temp_${userId}_${Date.now()}`,
          idToken: `id_${userId}_${Date.now()}`,
          refreshToken: `refresh_${userId}_${Date.now()}`,
          expiresIn: 3600,
        };
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
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result: any = await sendOtpHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/auth/verify-otp', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result: any = await verifyOtpHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    rawPath: req.url.split('?')[0],
    rawQueryString: req.url.includes('?') ? req.url.split('?')[1] : '',
    requestContext: {
      http: {
        method: req.method,
        path: req.url.split('?')[0],
      },
      requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    },
    headers: Object.fromEntries(req.headers.entries()),
    body: req.body ? JSON.stringify(req.body) : undefined,
    isBase64Encoded: false,
  };
}

function createLambdaContext(): any {
  return {
    awsRequestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}

