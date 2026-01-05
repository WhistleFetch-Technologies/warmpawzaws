"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthEndpoints = registerAuthEndpoints;
const client_sns_1 = require("@aws-sdk/client-sns");
const rds_connection_1 = require("../database/rds-connection");
const base_handler_1 = require("../handler/base-handler");
const cognito_client_1 = require("../utils/cognito-client");
async function createOtp(phone, code, purpose = 'login') {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry
    await (0, rds_connection_1.insert)('otp_tokens', {
        phone,
        code,
        purpose,
        expires_at: expiresAt,
        is_used: false,
        // Note: schema doesn't have 'attempts' field, tracking done separately if needed
    });
}
async function verifyOtp(phone, code) {
    const records = await (0, rds_connection_1.select)('otp_tokens', {
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
    await (0, rds_connection_1.query)('UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1', [record.id]);
    return true;
}
// ============================================================================
// SNS HELPER
// ============================================================================
async function sendSmsViaSns(phone, message) {
    try {
        // Get AWS settings from database
        const settings = await (0, rds_connection_1.select)('platform_settings', {
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
        const snsClient = new client_sns_1.SNSClient({
            region: awsSettings.sns.region || 'ap-south-1',
            credentials: {
                accessKeyId: awsSettings.credentials.accessKeyId,
                secretAccessKey: awsSettings.credentials.secretAccessKey,
            },
        });
        await snsClient.send(new client_sns_1.PublishCommand({
            PhoneNumber: phone,
            Message: message,
            MessageAttributes: {
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional',
                },
            },
        }));
        return true;
    }
    catch (error) {
        console.error('SNS send failed:', error);
        return false;
    }
}
// ============================================================================
// AUTH HANDLERS
// ============================================================================
class SendOtpHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { phone } = body;
        if (!phone) {
            return this.error('Phone number is required', 400);
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[AUTH] Generating OTP for ${phone}: ${otp}`);
        // Store OTP in database
        await createOtp(phone, otp, 'login');
        // Send SMS via SNS
        const message = `Your Warmpawz verification code is: ${otp}. Valid for 5 minutes.`;
        const sent = await sendSmsViaSns(phone, message);
        if (sent) {
            return this.success({ message: 'OTP sent via SMS' });
        }
        else {
            // Fallback: return OTP in response for development
            console.warn('[AUTH] SNS disabled or failed. OTP logged to console only.');
            return this.success({ debug_otp: otp, message: 'OTP sent (Mock Mode)' });
        }
    }
}
class VerifyOtpHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { phone, otp } = body;
        if (!phone || !otp) {
            return this.error('Phone and OTP are required', 400);
        }
        const isValid = await verifyOtp(phone, otp);
        if (!isValid) {
            return this.error('Invalid or expired OTP', 401);
        }
        // Create or get Cognito user
        let cognitoUser;
        let tokens;
        try {
            cognitoUser = await (0, cognito_client_1.getOrCreateCognitoUser)(phone);
            tokens = await (0, cognito_client_1.authenticateCognitoUser)(phone);
        }
        catch (error) {
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
function registerAuthEndpoints(app) {
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
function createApiGatewayEvent(req) {
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
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'auth-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=auth.js.map