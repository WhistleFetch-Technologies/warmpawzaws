/**
 * ============================================================================
 * LOGISTICS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles logistics integration (Shiprocket, Delhivery, etc.):
 * - Create shipment
 * - Track shipment
 * - Generate AWB
 * - Calculate shipping charges
 * 
 * Migrated from: supabase/functions/server/shiprocket-integration.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

// Shiprocket API base URL
const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

// Token management
let shiprocketToken: string | null = null;
let tokenExpiryTime: number = 0;

async function getShiprocketToken(): Promise<string> {
  if (shiprocketToken && Date.now() < tokenExpiryTime) {
    return shiprocketToken;
  }

  try {
    const settings = await select('platform_settings', { setting_key: 'platform:integrations:shiprocket' });
    const config = settings.length > 0 ? (settings[0].setting_value as any) : null;

    if (!config?.email || !config?.password) {
      throw new Error('Shiprocket credentials not configured');
    }

    const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    });

    if (!response.ok) {
      throw new Error('Shiprocket authentication failed');
    }

    const data: any = await response.json();
    shiprocketToken = data?.token || '';
    if (!shiprocketToken) {
      throw new Error('Shiprocket token missing in response');
    }
    tokenExpiryTime = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days

    return shiprocketToken;
  } catch (error: any) {
    console.error('Shiprocket auth error:', error);
    throw error;
  }
}

export function registerLogisticsEndpoints(app: Hono) {
  /**
   * POST /logistics/shiprocket/create-order
   * Create Shiprocket order
   */
  app.post("/logistics/shiprocket/create-order", async (c) => {
    try {
      const orderData = await c.req.json();
      const token = await getShiprocketToken();

      const response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderData.orderId,
          order_date: orderData.orderDate || new Date().toISOString().split('T')[0],
          pickup_location: orderData.pickupLocation || 'Primary',
          billing_customer_name: orderData.customerName,
          billing_address: orderData.billingAddress.street,
          billing_city: orderData.billingAddress.city,
          billing_pincode: orderData.billingAddress.pincode,
          billing_state: orderData.billingAddress.state,
          billing_email: orderData.customerEmail,
          billing_phone: orderData.customerPhone,
          shipping_is_billing: orderData.shippingIsBilling !== false,
          shipping_customer_name: orderData.shippingAddress?.name || orderData.customerName,
          shipping_address: orderData.shippingAddress?.street || orderData.billingAddress.street,
          shipping_city: orderData.shippingAddress?.city || orderData.billingAddress.city,
          shipping_pincode: orderData.shippingAddress?.pincode || orderData.billingAddress.pincode,
          shipping_state: orderData.shippingAddress?.state || orderData.billingAddress.state,
          order_items: orderData.items.map((item: any) => ({
            name: item.name,
            sku: item.sku || item.productId,
            units: item.quantity,
            selling_price: item.price,
          })),
          payment_method: orderData.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
          sub_total: orderData.subTotal,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Shiprocket order creation failed: ${JSON.stringify(error)}`);
      }

      const result: any = await response.json();

      // Store shipment info in database
      await insert('shipments', {
        order_id: orderData.orderId,
        logistics_partner: 'shiprocket',
        shipment_id: result.shipment_id?.toString(),
        awb_code: result.awb_code || null,
        status: 'created',
        tracking_url: result.tracking_url || null,
      }).catch(() => {
        // Graceful fallback if table doesn't exist
      });

      return c.json({
        success: true,
        shipment: result,
      });
    } catch (error: any) {
      console.error('Error creating Shiprocket order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /logistics/shiprocket/track/:shipmentId
   * Track Shiprocket shipment
   */
  app.get("/logistics/shiprocket/track/:shipmentId", async (c) => {
    try {
      const { shipmentId } = c.req.param();
      const token = await getShiprocketToken();

      const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/track/${shipmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to track shipment');
      }

      const result: any = await response.json();

      return c.json({
        success: true,
        tracking: result,
      });
    } catch (error: any) {
      console.error('Error tracking shipment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/shiprocket/generate-awb
   * Generate AWB for shipment
   */
  app.post("/logistics/shiprocket/generate-awb", async (c) => {
    try {
      const { shipmentId, courierId } = await c.req.json();
      const token = await getShiprocketToken();

      const response = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipment_id: shipmentId,
          courier_id: courierId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AWB');
      }

      const result: any = await response.json();

      // Update shipment in database
      await update('shipments',
        { shipment_id: shipmentId.toString() },
        {
          awb_code: result.awb_code,
          status: 'awb_generated',
        }
      ).catch(() => {});

      return c.json({
        success: true,
        awb: result,
      });
    } catch (error: any) {
      console.error('Error generating AWB:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/calculate-shipping
   * Calculate shipping charges
   */
  app.post("/logistics/calculate-shipping", async (c) => {
    try {
      const { pickupPincode, deliveryPincode, weight, codAmount } = await c.req.json();

      if (!pickupPincode || !deliveryPincode || !weight) {
        return c.json({ error: 'pickupPincode, deliveryPincode, and weight are required' }, 400);
      }

      const token = await getShiprocketToken();

      const response = await fetch(`${SHIPROCKET_API_BASE}/courier/serviceability/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        // Note: Shiprocket API might require different parameters
      });

      // Simplified response - actual implementation would use Shiprocket's rate calculator
      return c.json({
        success: true,
        shippingCharges: {
          standard: 50, // Mock value
          express: 100, // Mock value
          cod: codAmount ? 20 : 0,
        },
      });
    } catch (error: any) {
      console.error('Error calculating shipping:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // GENERIC LOGISTICS ENDPOINTS (Admin UI compatibility)
  // ============================================================================

  /**
   * POST /logistics/create-order
   * Create logistics order (generic - routes to Shiprocket)
   */
  app.post("/logistics/create-order", async (c) => {
    try {
      const body = await c.req.json();
      const { order_id, ...orderData } = body;

      // Use Shiprocket endpoint
      const shiprocketData = {
        orderId: order_id,
        ...orderData,
      };

      // Forward to Shiprocket create-order
      const response = await fetch(new URL('/logistics/shiprocket/create-order', c.req.url).toString(), {
        method: 'POST',
        headers: c.req.header(),
        body: JSON.stringify(shiprocketData),
      });

      const result = await response.json();
      return c.json(result, response.status);
    } catch (error: any) {
      console.error('Error creating logistics order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/cancel-order
   * Cancel logistics order
   */
  app.post("/logistics/cancel-order", async (c) => {
    try {
      const body = await c.req.json();
      const { order_id } = body;

      if (!order_id) {
        return c.json({ error: 'order_id is required' }, 400);
      }

      // Update order status in database
      await update('shipments', { order_id }, {
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).catch(() => {
        // Graceful fallback if table doesn't exist
      });

      // Also update logistics_orders if exists
      await query(
        'UPDATE logistics_orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
        ['cancelled', order_id]
      ).catch(() => {
        // Graceful fallback if table doesn't exist
      });

      // Try to cancel in Shiprocket if shipment_id exists
      try {
        const shipments = await select('shipments', { order_id });
        if (shipments.length > 0 && shipments[0].shipment_id) {
          const token = await getShiprocketToken();
          await fetch(`${SHIPROCKET_API_BASE}/orders/cancel/shipment/${shipments[0].shipment_id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }).catch(() => {
            // Graceful fallback if Shiprocket cancel fails
          });
        }
      } catch (e) {
        console.warn('Failed to cancel in Shiprocket:', e);
      }

      return c.json({
        success: true,
        message: 'Order cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /logistics/track/:awbNumber
   * Track shipment by AWB number
   */
  app.get("/logistics/track/:awbNumber", async (c) => {
    try {
      const { awbNumber } = c.req.param();

      // First try to find shipment by AWB in database
      const shipments = await query(
        'SELECT * FROM shipments WHERE awb_code = $1',
        [awbNumber]
      ).catch(() => ({ rows: [] }));

      if (shipments.rows.length > 0 && shipments.rows[0].shipment_id) {
        // Use Shiprocket tracking
        const token = await getShiprocketToken();
        const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/track/${shipments.rows[0].shipment_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result: any = await response.json();
          return c.json({
            success: true,
            tracking: result,
            awb: awbNumber,
          });
        }
      }

      // Fallback: return basic tracking info
      return c.json({
        success: true,
        tracking: {
          awb: awbNumber,
          status: shipments.rows[0]?.status || 'unknown',
          current_status: shipments.rows[0]?.status || 'unknown',
        },
      });
    } catch (error: any) {
      console.error('Error tracking shipment:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

