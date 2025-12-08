/**
 * INTEGRATION INITIALIZATION SCRIPT
 * 
 * This script initializes Razorpay and Shiprocket integrations
 * by reading from environment variables and storing in KV
 * 
 * Environment Variables Required:
 * - RAZORPAY_KEY_ID
 * - RAZORPAY_KEY_SECRET
 * - RAZORPAY_WEBHOOK_SECRET
 * - SHIPROCKET_EMAIL
 * - SHIPROCKET_PASSWORD
 */

import type { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const BASE_PATH = '/make-server-3dd53475';

export function registerIntegrationInitEndpoints(app: Hono) {

  /**
   * POST /admin/integrations/initialize
   * Initialize all integrations from environment variables
   */
  app.post(`${BASE_PATH}/admin/integrations/initialize`, async (c) => {
    try {
      const results = {
        razorpay: { status: 'not_configured', message: '' },
        shiprocket: { status: 'not_configured', message: '' }
      };

      // ============================================
      // RAZORPAY INITIALIZATION
      // ============================================
      const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      const razorpayWebhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

      if (razorpayKeyId && razorpayKeySecret) {
        // Store in platform:integrations:razorpay (for razorpay-payment-integration.tsx)
        await kv.set('platform:integrations:razorpay', {
          keyId: razorpayKeyId,
          keySecret: razorpayKeySecret,
          webhookSecret: razorpayWebhookSecret || 'test_webhook_secret',
          enabled: true,
          mode: razorpayKeyId.startsWith('rzp_test') ? 'test' : 'live',
          updatedAt: new Date().toISOString()
        });

        // Also store in platform:settings:payment_gateway (for razorpay-integration.tsx)
        await kv.set('platform:settings:payment_gateway', {
          razorpay: {
            key_id: razorpayKeyId,
            key_secret: razorpayKeySecret,
            webhook_secret: razorpayWebhookSecret || 'test_webhook_secret',
            enabled: true
          },
          default_gateway: 'razorpay',
          updatedAt: new Date().toISOString()
        });

        // Also store in admin:settings:payment (for refund processor and settlements)
        await kv.set('admin:settings:payment', {
          razorpay: {
            keyId: razorpayKeyId,
            keySecret: razorpayKeySecret,
            webhookSecret: razorpayWebhookSecret || 'test_webhook_secret',
            enabled: true
          },
          updatedAt: new Date().toISOString()
        });

        results.razorpay = {
          status: 'configured',
          message: `Razorpay configured successfully (${razorpayKeyId.startsWith('rzp_test') ? 'TEST' : 'LIVE'} mode)`,
          keyId: razorpayKeyId,
          mode: razorpayKeyId.startsWith('rzp_test') ? 'test' : 'live'
        };

        console.log(`✅ Razorpay initialized: ${razorpayKeyId}`);
      } else {
        results.razorpay = {
          status: 'missing_credentials',
          message: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables not found'
        };
        console.warn('⚠️ Razorpay credentials not found in environment');
      }

      // ============================================
      // SHIPROCKET INITIALIZATION
      // ============================================
      const shiprocketEmail = Deno.env.get('SHIPROCKET_EMAIL');
      const shiprocketPassword = Deno.env.get('SHIPROCKET_PASSWORD');

      if (shiprocketEmail && shiprocketPassword) {
        await kv.set('platform:settings:logistics', {
          shiprocket: {
            email: shiprocketEmail,
            password: shiprocketPassword,
            enabled: true
          },
          default_provider: 'shiprocket',
          updatedAt: new Date().toISOString()
        });

        results.shiprocket = {
          status: 'configured',
          message: 'Shiprocket configured successfully',
          email: shiprocketEmail
        };

        console.log(`✅ Shiprocket initialized: ${shiprocketEmail}`);
      } else {
        results.shiprocket = {
          status: 'missing_credentials',
          message: 'SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD environment variables not found'
        };
        console.warn('⚠️ Shiprocket credentials not found in environment');
      }

      // ============================================
      // RESPONSE
      // ============================================
      const allConfigured = results.razorpay.status === 'configured' && 
                            results.shiprocket.status === 'configured';

      return c.json({
        success: allConfigured,
        message: allConfigured 
          ? 'All integrations configured successfully' 
          : 'Some integrations could not be configured',
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error initializing integrations:', error);
      return c.json({
        success: false,
        error: error.message,
        message: 'Failed to initialize integrations'
      }, 500);
    }
  });

  /**
   * GET /admin/integrations/status
   * Check integration status
   */
  app.get(`${BASE_PATH}/admin/integrations/status`, async (c) => {
    try {
      const razorpayConfig = await kv.get('platform:integrations:razorpay');
      const shiprocketConfig = await kv.get('platform:settings:logistics');

      return c.json({
        success: true,
        integrations: {
          razorpay: {
            configured: !!(razorpayConfig?.value?.keyId),
            enabled: razorpayConfig?.value?.enabled || false,
            mode: razorpayConfig?.value?.mode || 'unknown',
            keyId: razorpayConfig?.value?.keyId ? 
                   `${razorpayConfig.value.keyId.substring(0, 10)}...` : 
                   null
          },
          shiprocket: {
            configured: !!(shiprocketConfig?.value?.shiprocket?.email),
            enabled: shiprocketConfig?.value?.shiprocket?.enabled || false,
            email: shiprocketConfig?.value?.shiprocket?.email || null
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error checking integration status:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * POST /admin/integrations/test-razorpay
   * Test Razorpay connection
   */
  app.post(`${BASE_PATH}/admin/integrations/test-razorpay`, async (c) => {
    try {
      const razorpayConfig = await kv.get('platform:integrations:razorpay');
      
      if (!razorpayConfig || !razorpayConfig.value) {
        return c.json({
          success: false,
          error: 'Razorpay not configured'
        }, 400);
      }

      const config = razorpayConfig.value;
      
      // Test API call to Razorpay
      const auth = btoa(`${config.keyId}:${config.keySecret}`);
      const response = await fetch('https://api.razorpay.com/v1/payments?count=1', {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (response.ok) {
        return c.json({
          success: true,
          message: 'Razorpay connection successful',
          mode: config.mode,
          timestamp: new Date().toISOString()
        });
      } else {
        const error = await response.json();
        return c.json({
          success: false,
          error: 'Razorpay authentication failed',
          details: error
        }, 401);
      }

    } catch (error: any) {
      console.error('Error testing Razorpay:', error);
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  });

  /**
   * POST /admin/integrations/test-shiprocket
   * Test Shiprocket connection
   */
  app.post(`${BASE_PATH}/admin/integrations/test-shiprocket`, async (c) => {
    try {
      const shiprocketConfig = await kv.get('platform:settings:logistics');
      
      if (!shiprocketConfig || !shiprocketConfig.value?.shiprocket) {
        return c.json({
          success: false,
          error: 'Shiprocket not configured'
        }, 400);
      }

      const config = shiprocketConfig.value.shiprocket;
      
      // Test API call to Shiprocket
      const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: config.email,
          password: config.password
        })
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        return c.json({
          success: true,
          message: 'Shiprocket connection successful',
          email: config.email,
          tokenReceived: !!authData.token,
          timestamp: new Date().toISOString()
        });
      } else {
        const error = await authResponse.json();
        return c.json({
          success: false,
          error: 'Shiprocket authentication failed',
          details: error
        }, 401);
      }

    } catch (error: any) {
      console.error('Error testing Shiprocket:', error);
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  });

  console.log('✅ Integration initialization endpoints registered');
}
