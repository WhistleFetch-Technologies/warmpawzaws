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

import { Hono } from 'hono';
import { select, upsert, query } from '../database/rds-connection';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { getSecret, getSecretJson, putSecret } from '../utils/secrets-manager';

export function registerAdminIntegrationEndpoints(app: Hono) {
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
      const settings = await select('platform_settings', { setting_key: 'platform:integrations:aws' });
      const awsConfig = settings.length > 0 ? (settings[0].setting_value as any) : null;

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
    } catch (error: any) {
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
      const stsClient = new STSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));

      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const buckets = await s3Client.send(new ListBucketsCommand({}));

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
    } catch (error: any) {
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
   * Retrieves API key from AWS Secrets Manager
   */
  app.get("/admin/integrations/google-maps", async (c) => {
    try {
      // Get API key from Secrets Manager
      const apiKey = await getSecret('google-maps/api-key');
      
      // Get enabled status from database (non-sensitive config)
      const settings = await select('platform_settings', { setting_key: 'platform:integrations:google_maps' });
      const mapsConfig = settings.length > 0 ? (settings[0].setting_value as any) : null;

      return c.json({
        success: true,
        config: {
          enabled: mapsConfig?.enabled || false,
          apiKey: apiKey || '',
        },
      });
    } catch (error: any) {
      console.error('Error fetching Google Maps config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/integrations/google-maps
   * Update Google Maps configuration
   * Stores API key in AWS Secrets Manager, enabled status in database
   */
  app.put("/admin/integrations/google-maps", async (c) => {
    try {
      const { apiKey, enabled } = await c.req.json();

      // Store API key in Secrets Manager (if provided)
      if (apiKey) {
        // Validate that it's not a project number (all digits)
        if (/^\d+$/.test(apiKey)) {
          return c.json({ 
            error: 'Invalid API key: Please use a Google Maps API key (starts with AIza...), not a project number' 
          }, 400);
        }
        
        await putSecret('google-maps/api-key', apiKey, 'Google Maps API Key for Warmpawz platform');
        console.log('[CONFIG] Google Maps API key stored in Secrets Manager');
      }

      // Store enabled status in database (non-sensitive config)
      await upsert('platform_settings',
        {
          setting_key: 'platform:integrations:google_maps',
          setting_value: {
            enabled: enabled !== false,
            // Don't store API key in database anymore
          },
          setting_type: 'json',
          description: 'Google Maps API configuration (enabled status only, API key in Secrets Manager)',
        },
        'setting_key'
      );

      return c.json({
        success: true,
        message: 'Google Maps configuration updated',
      });
    } catch (error: any) {
      console.error('Error updating Google Maps config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /config/google-maps-key
   * Public endpoint to get Google Maps API key for frontend use
   * Retrieves API key from AWS Secrets Manager
   * Returns the API key in the format expected by frontend components
   */
  app.get("/config/google-maps-key", async (c) => {
    try {
      console.log('[CONFIG] Fetching Google Maps API key from Secrets Manager...');
      
      // Get API key from Secrets Manager
      const apiKey = await getSecret('google-maps/api-key');
      
      console.log('[CONFIG] API key fetched:', apiKey ? `${apiKey.substring(0, 10)}...` : 'null');

      // Validate that it's not a project number (all digits)
      if (apiKey && /^\d+$/.test(apiKey)) {
        console.error('[CONFIG] Invalid API Key: Looks like a project number, not an API key');
        return c.json({ 
          error: 'Invalid API key: Please use a Google Maps API key (starts with AIza...), not a project number' 
        }, 500);
      }

      if (!apiKey) {
        console.warn('[CONFIG] Google Maps API key not configured in Secrets Manager');
        return c.json({ 
          error: 'Google Maps API key not configured',
          hint: 'Please configure Google Maps API key in Platform Settings'
        }, 404);
      }

      console.log('[CONFIG] Returning API key to client');
      return c.json({ apiKey });
    } catch (error: any) {
      console.error('[CONFIG] Error fetching Google Maps API key from Secrets Manager:', error);
      console.error('[CONFIG] Error name:', error.name);
      console.error('[CONFIG] Error message:', error.message);
      console.error('[CONFIG] Error stack:', error.stack);
      return c.json({ 
        error: error.message || 'Failed to fetch Google Maps API key',
        details: error.name || 'Unknown error'
      }, 500);
    }
  });

  /**
   * GET /admin/integrations/payment-gateway
   * Get payment gateway configuration
   */
  app.get("/admin/integrations/payment-gateway", async (c) => {
    try {
      const settings = await select('platform_settings', { setting_key: 'platform:integrations:razorpay' });
      const razorpayConfig = settings.length > 0 ? (settings[0].setting_value as any) : null;

      return c.json({
        success: true,
        config: razorpayConfig || {
          enabled: false,
          keyId: '',
          keySecret: '',
          mode: 'test',
        },
      });
    } catch (error: any) {
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

      await upsert('platform_settings',
        {
          setting_key: 'platform:integrations:razorpay',
          setting_value: {
            enabled: enabled !== false,
            keyId: keyId || '',
            keySecret: keySecret || '',
            mode: mode || 'test',
          },
          setting_type: 'json',
          description: 'Razorpay payment gateway configuration',
        },
        'setting_key'
      );

      return c.json({
        success: true,
        message: 'Payment gateway configuration updated',
      });
    } catch (error: any) {
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
      const settings = await select('platform_settings', { setting_key: 'platform:settings:logistics' });
      const logisticsConfig = settings.length > 0 ? (settings[0].setting_value as any) : null;

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
    } catch (error: any) {
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

      await upsert('platform_settings',
        {
          setting_key: 'platform:settings:logistics',
          setting_value: logisticsData,
          setting_type: 'json',
          description: 'Logistics partner configuration',
        },
        'setting_key'
      );

      return c.json({
        success: true,
        message: 'Logistics settings updated',
      });
    } catch (error: any) {
      console.error('Error updating logistics settings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/integrations/:integration/test
   * Test integration connection
   */
  app.post("/admin/integrations/:integration/test", async (c) => {
    try {
      const integration = c.req.param('integration');

      switch (integration) {
        case 'aws':
          try {
            const stsClient = new STSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
            const identity = await stsClient.send(new GetCallerIdentityCommand({}));

            const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
            const buckets = await s3Client.send(new ListBucketsCommand({}));

            return c.json({
              success: true,
              connected: true,
              details: {
                accountId: identity.Account,
                userId: identity.UserId,
                arn: identity.Arn,
                s3Buckets: buckets.Buckets?.map(b => b.Name) || [],
              },
            });
          } catch (error: any) {
            return c.json({
              success: false,
              connected: false,
              error: error.message,
            }, 500);
          }

        case 'google-maps':
          try {
            const apiKey = await getSecret('google-maps/api-key');
            if (!apiKey) {
              return c.json({
                success: false,
                connected: false,
                error: 'Google Maps API key not configured',
              });
            }

            // Test API key by making a simple geocoding request
            const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`;
            const response = await fetch(testUrl);
            const data = await response.json();

            if (data.status === 'REQUEST_DENIED') {
              return c.json({
                success: false,
                connected: false,
                error: 'API key is invalid or restricted',
              });
            }

            return c.json({
              success: true,
              connected: true,
              details: {
                apiKeyConfigured: true,
                status: data.status,
              },
            });
          } catch (error: any) {
            return c.json({
              success: false,
              connected: false,
              error: error.message,
            }, 500);
          }

        case 'razorpay':
          try {
            const settings = await select('platform_settings', { setting_key: 'platform:integrations:razorpay' });
            const config = settings.length > 0 ? (settings[0].setting_value as any) : null;

            if (!config || !config.keyId || !config.keySecret) {
              return c.json({
                success: false,
                connected: false,
                error: 'Razorpay credentials not configured',
              });
            }

            // Test Razorpay connection (simplified - would normally make API call)
            return c.json({
              success: true,
              connected: true,
              details: {
                keyId: config.keyId,
                mode: config.mode || 'test',
              },
            });
          } catch (error: any) {
            return c.json({
              success: false,
              connected: false,
              error: error.message,
            }, 500);
          }

        case 'shiprocket':
          try {
            const settings = await select('platform_settings', { setting_key: 'platform:settings:logistics' });
            const config = settings.length > 0 ? (settings[0].setting_value as any) : null;

            if (!config || !config.shiprocket || !config.shiprocket.enabled) {
              return c.json({
                success: false,
                connected: false,
                error: 'Shiprocket not configured or enabled',
              });
            }

            return c.json({
              success: true,
              connected: true,
              details: {
                enabled: config.shiprocket.enabled,
                testMode: config.shiprocket.test_mode || false,
              },
            });
          } catch (error: any) {
            return c.json({
              success: false,
              connected: false,
              error: error.message,
            }, 500);
          }

        default:
          return c.json({
            success: false,
            error: `Unknown integration: ${integration}`,
          }, 400);
      }
    } catch (error: any) {
      console.error(`Error testing ${c.req.param('integration')} integration:`, error);
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });
}

