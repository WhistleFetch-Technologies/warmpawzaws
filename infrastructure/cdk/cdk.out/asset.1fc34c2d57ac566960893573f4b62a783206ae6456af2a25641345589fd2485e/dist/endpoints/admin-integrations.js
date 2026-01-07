"use strict";
/**
 * ============================================================================
 * ADMIN INTEGRATION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles platform integrations:
 * - AWS configuration
 * - Google Maps configuration
 * - Payment gateway settings
 * - Logistics partners
 * - Connection testing
 *
 * Migrated from: supabase/functions/make-server-3dd53475/admin-integration-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminIntegrationEndpoints = registerAdminIntegrationEndpoints;
const rds_connection_1 = require("../database/rds-connection");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sts_1 = require("@aws-sdk/client-sts");
function registerAdminIntegrationEndpoints(app) {
    /**
     * GET /admin/integrations/test
     * Test endpoint to verify registration
     */
    app.get("/admin/integrations/test", async (c) => {
        return c.json({
            success: true,
            message: 'Admin integration endpoints are working!',
            timestamp: new Date().toISOString(),
        });
    });
    /**
     * GET /admin/integrations/aws
     * Get AWS configuration
     */
    app.get("/admin/integrations/aws", async (c) => {
        try {
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'platform:integrations:aws' });
            const awsConfig = settings.length > 0 ? settings[0].setting_value : null;
            return c.json({
                success: true,
                config: awsConfig || {
                    region: process.env.AWS_REGION || 'ap-south-1',
                    s3: {
                        bucket: process.env.S3_BUCKET_NAME || '',
                        enabled: !!process.env.S3_BUCKET_NAME,
                    },
                    sns: {
                        enabled: !!process.env.BOOKING_CREATED_TOPIC_ARN,
                    },
                },
            });
        }
        catch (error) {
            console.error('Error fetching AWS config:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /admin/integrations/aws/test
     * Test AWS connection
     */
    app.post("/admin/integrations/aws/test", async (c) => {
        try {
            const stsClient = new client_sts_1.STSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
            const identity = await stsClient.send(new client_sts_1.GetCallerIdentityCommand({}));
            const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
            const buckets = await s3Client.send(new client_s3_1.ListBucketsCommand({}));
            return c.json({
                success: true,
                aws: {
                    accountId: identity.Account,
                    userId: identity.UserId,
                    arn: identity.Arn,
                },
                s3: {
                    buckets: buckets.Buckets?.map(b => b.Name) || [],
                },
            });
        }
        catch (error) {
            console.error('Error testing AWS connection:', error);
            return c.json({
                success: false,
                error: error.message,
            }, 500);
        }
    });
    /**
     * GET /admin/integrations/google-maps
     * Get Google Maps configuration
     */
    app.get("/admin/integrations/google-maps", async (c) => {
        try {
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'platform:integrations:google_maps' });
            const mapsConfig = settings.length > 0 ? settings[0].setting_value : null;
            return c.json({
                success: true,
                config: mapsConfig || {
                    enabled: false,
                    apiKey: '',
                },
            });
        }
        catch (error) {
            console.error('Error fetching Google Maps config:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /admin/integrations/google-maps
     * Update Google Maps configuration
     */
    app.put("/admin/integrations/google-maps", async (c) => {
        try {
            const { apiKey, enabled } = await c.req.json();
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'platform:integrations:google_maps',
                setting_value: {
                    enabled: enabled !== false,
                    apiKey: apiKey || '',
                },
                setting_type: 'json',
                description: 'Google Maps API configuration',
            }, 'setting_key');
            return c.json({
                success: true,
                message: 'Google Maps configuration updated',
            });
        }
        catch (error) {
            console.error('Error updating Google Maps config:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /admin/integrations/payment-gateway
     * Get payment gateway configuration
     */
    app.get("/admin/integrations/payment-gateway", async (c) => {
        try {
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'platform:integrations:razorpay' });
            const razorpayConfig = settings.length > 0 ? settings[0].setting_value : null;
            return c.json({
                success: true,
                config: razorpayConfig || {
                    enabled: false,
                    keyId: '',
                    keySecret: '',
                    mode: 'test',
                },
            });
        }
        catch (error) {
            console.error('Error fetching payment gateway config:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /admin/integrations/payment-gateway
     * Update payment gateway configuration
     */
    app.put("/admin/integrations/payment-gateway", async (c) => {
        try {
            const { keyId, keySecret, mode, enabled } = await c.req.json();
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'platform:integrations:razorpay',
                setting_value: {
                    enabled: enabled !== false,
                    keyId: keyId || '',
                    keySecret: keySecret || '',
                    mode: mode || 'test',
                },
                setting_type: 'json',
                description: 'Razorpay payment gateway configuration',
            }, 'setting_key');
            return c.json({
                success: true,
                message: 'Payment gateway configuration updated',
            });
        }
        catch (error) {
            console.error('Error updating payment gateway config:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /admin/integrations/logistics
     * Get logistics settings
     */
    app.get("/admin/integrations/logistics", async (c) => {
        try {
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'platform:settings:logistics' });
            const logisticsConfig = settings.length > 0 ? settings[0].setting_value : null;
            const defaultSettings = {
                shiprocket: { enabled: false, test_mode: true },
                delhivery: { enabled: false, test_mode: true },
                bluedart: { enabled: false, test_mode: true },
                default_provider: 'shiprocket',
                warehouse_address: {},
            };
            return c.json({
                success: true,
                settings: logisticsConfig || defaultSettings,
            });
        }
        catch (error) {
            console.error('Error fetching logistics settings:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /admin/integrations/logistics
     * Update logistics settings
     */
    app.put("/admin/integrations/logistics", async (c) => {
        try {
            const logisticsData = await c.req.json();
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'platform:settings:logistics',
                setting_value: logisticsData,
                setting_type: 'json',
                description: 'Logistics partner configuration',
            }, 'setting_key');
            return c.json({
                success: true,
                message: 'Logistics settings updated',
            });
        }
        catch (error) {
            console.error('Error updating logistics settings:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=admin-integrations.js.map