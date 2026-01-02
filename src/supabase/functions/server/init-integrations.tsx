/**
 * Integration Initialization Endpoints
 * Provides status and health checks for all integrations
 */

import { Hono } from 'hono';

export function registerIntegrationInitEndpoints(app: Hono) {
  
  /**
   * GET /integrations/status
   * Get status of all configured integrations
   */
  app.get('/make-server-3dd53475/integrations/status', async (c) => {
    try {
      const razorpayEnabled = !!(Deno.env.get('RAZORPAY_KEY_ID') && Deno.env.get('RAZORPAY_KEY_SECRET'));
      const shiprocketEnabled = !!(Deno.env.get('SHIPROCKET_EMAIL') && Deno.env.get('SHIPROCKET_PASSWORD'));
      const googleMapsEnabled = !!Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
      
      return c.json({
        success: true,
        integrations: {
          razorpay: {
            enabled: razorpayEnabled,
            status: razorpayEnabled ? 'active' : 'disabled',
            capabilities: ['payments', 'refunds', 'payouts']
          },
          shiprocket: {
            enabled: shiprocketEnabled,
            status: shiprocketEnabled ? 'active' : 'disabled',
            capabilities: ['order_fulfillment', 'tracking', 'returns']
          },
          googleMaps: {
            enabled: googleMapsEnabled,
            status: googleMapsEnabled ? 'active' : 'disabled',
            capabilities: ['geocoding', 'places', 'directions']
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching integration status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Integration init endpoints registered');
}
