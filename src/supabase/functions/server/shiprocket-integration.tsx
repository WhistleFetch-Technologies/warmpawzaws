/**
 * Shiprocket Integration for Warmpawz
 * Handles order fulfillment and logistics for marketplace vendors
 */

import { Hono } from 'hono';
import * as kv from './kv_store';

// Shiprocket credentials from environment
const SHIPROCKET_EMAIL = Deno.env.get('SHIPROCKET_EMAIL') || '';
const SHIPROCKET_PASSWORD = Deno.env.get('SHIPROCKET_PASSWORD') || '';
const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

// Token management
let shiprocketToken: string | null = null;
let tokenExpiryTime: number = 0;

/**
 * Authenticate with Shiprocket and get token
 */
async function getShiprocketToken(): Promise<string> {
  // Return cached token if still valid
  if (shiprocketToken && Date.now() < tokenExpiryTime) {
    return shiprocketToken;
  }

  try {
    const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: SHIPROCKET_EMAIL,
        password: SHIPROCKET_PASSWORD
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Shiprocket auth failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    shiprocketToken = data.token;
    tokenExpiryTime = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days validity
    
    console.log('✅ Shiprocket token obtained');
    return shiprocketToken;
  } catch (error) {
    console.error('❌ Shiprocket auth error:', error);
    throw error;
  }
}

/**
 * Create Shiprocket Order
 */
export async function createShiprocketOrder(orderData: any) {
  try {
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
        channel_id: orderData.channelId || '',
        comment: orderData.comment || 'Warmpawz Order',
        billing_customer_name: orderData.customerName,
        billing_last_name: orderData.customerLastName || '',
        billing_address: orderData.billingAddress.street,
        billing_address_2: orderData.billingAddress.landmark || '',
        billing_city: orderData.billingAddress.city,
        billing_pincode: orderData.billingAddress.pincode,
        billing_state: orderData.billingAddress.state,
        billing_country: 'India',
        billing_email: orderData.customerEmail,
        billing_phone: orderData.customerPhone,
        shipping_is_billing: orderData.shippingIsBilling !== false,
        shipping_customer_name: orderData.shippingAddress?.name || orderData.customerName,
        shipping_last_name: orderData.shippingAddress?.lastName || '',
        shipping_address: orderData.shippingAddress?.street || orderData.billingAddress.street,
        shipping_address_2: orderData.shippingAddress?.landmark || orderData.billingAddress.landmark || '',
        shipping_city: orderData.shippingAddress?.city || orderData.billingAddress.city,
        shipping_pincode: orderData.shippingAddress?.pincode || orderData.billingAddress.pincode,
        shipping_country: 'India',
        shipping_state: orderData.shippingAddress?.state || orderData.billingAddress.state,
        shipping_email: orderData.shippingAddress?.email || orderData.customerEmail,
        shipping_phone: orderData.shippingAddress?.phone || orderData.customerPhone,
        order_items: orderData.items.map((item: any) => ({
          name: item.name,
          sku: item.sku || item.productId,
          units: item.quantity,
          selling_price: item.price,
          discount: item.discount || 0,
          tax: item.tax || 0,
          hsn: item.hsn || 0
        })),
        payment_method: orderData.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        shipping_charges: orderData.shippingCharges || 0,
        giftwrap_charges: orderData.giftwrapCharges || 0,
        transaction_charges: orderData.transactionCharges || 0,
        total_discount: orderData.totalDiscount || 0,
        sub_total: orderData.subTotal,
        length: orderData.length || 10,
        breadth: orderData.breadth || 10,
        height: orderData.height || 10,
        weight: orderData.weight || 0.5
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Shiprocket order creation failed: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('✅ Shiprocket order created:', result.order_id);
    return result;
  } catch (error) {
    console.error('❌ Shiprocket order creation error:', error);
    throw error;
  }
}

/**
 * Generate AWB (Airway Bill) for Shipment
 */
export async function generateAWB(shipmentId: number, courierId: number) {
  try {
    const token = await getShiprocketToken();
    
    const response = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shipment_id: shipmentId,
        courier_id: courierId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`AWB generation failed: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('✅ AWB generated:', result.response.data.awb_code);
    return result;
  } catch (error) {
    console.error('❌ AWB generation error:', error);
    throw error;
  }
}

/**
 * Get Available Couriers for Shipment
 */
export async function getAvailableCouriers(pickupPincode: string, deliveryPincode: string, weight: number, cod: boolean = false) {
  try {
    const token = await getShiprocketToken();
    
    const response = await fetch(
      `${SHIPROCKET_API_BASE}/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=${cod ? 1 : 0}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch couriers');
    }

    const result = await response.json();
    return result.data.available_courier_companies || [];
  } catch (error) {
    console.error('❌ Fetch couriers error:', error);
    throw error;
  }
}

/**
 * Track Shipment
 */
export async function trackShipment(shipmentId: number) {
  try {
    const token = await getShiprocketToken();
    
    const response = await fetch(`${SHIPROCKET_API_BASE}/courier/track/shipment/${shipmentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      throw new Error('Failed to track shipment');
    }

    const result = await response.json();
    return result.tracking_data;
  } catch (error) {
    console.error('❌ Track shipment error:', error);
    throw error;
  }
}

/**
 * Cancel Shipment
 */
export async function cancelShipment(orderIds: string[]) {
  try {
    const token = await getShiprocketToken();
    
    const response = await fetch(`${SHIPROCKET_API_BASE}/orders/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: orderIds
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Shipment cancellation failed: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('✅ Shipment cancelled:', orderIds);
    return result;
  } catch (error) {
    console.error('❌ Shipment cancellation error:', error);
    throw error;
  }
}

/**
 * Create Return Order
 */
export async function createReturnOrder(orderData: any) {
  try {
    const token = await getShiprocketToken();
    
    const response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/return`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Return order creation failed: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('✅ Return order created:', result.order_id);
    return result;
  } catch (error) {
    console.error('❌ Return order creation error:', error);
    throw error;
  }
}

/**
 * Shiprocket Endpoints for Hono
 */
export function registerShiprocketIntegration(app: Hono) {
  
  /**
   * GET /shiprocket/config
   * Get Shiprocket configuration status
   */
  app.get('/make-server-3dd53475/shiprocket/config', async (c) => {
    try {
      return c.json({
        success: true,
        enabled: !!SHIPROCKET_EMAIL && !!SHIPROCKET_PASSWORD
      });
    } catch (error: any) {
      console.error('Error fetching Shiprocket config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /shiprocket/orders/create
   * Create Shiprocket order
   */
  app.post('/make-server-3dd53475/shiprocket/orders/create', async (c) => {
    try {
      const orderData = await c.req.json();
      const result = await createShiprocketOrder(orderData);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error creating Shiprocket order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /shiprocket/couriers/available
   * Get available couriers for shipment
   */
  app.get('/make-server-3dd53475/shiprocket/couriers/available', async (c) => {
    try {
      const pickupPincode = c.req.query('pickupPincode') || '';
      const deliveryPincode = c.req.query('deliveryPincode') || '';
      const weight = parseFloat(c.req.query('weight') || '0.5');
      const cod = c.req.query('cod') === 'true';
      
      const couriers = await getAvailableCouriers(pickupPincode, deliveryPincode, weight, cod);
      
      return c.json({
        success: true,
        couriers
      });
    } catch (error: any) {
      console.error('Error fetching couriers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /shiprocket/shipments/generate-awb
   * Generate AWB for shipment
   */
  app.post('/make-server-3dd53475/shiprocket/shipments/generate-awb', async (c) => {
    try {
      const { shipmentId, courierId } = await c.req.json();
      const result = await generateAWB(shipmentId, courierId);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error generating AWB:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /shiprocket/shipments/track/:shipmentId
   * Track shipment
   */
  app.get('/make-server-3dd53475/shiprocket/shipments/track/:shipmentId', async (c) => {
    try {
      const shipmentId = parseInt(c.req.param('shipmentId'));
      const trackingData = await trackShipment(shipmentId);
      
      return c.json({
        success: true,
        trackingData
      });
    } catch (error: any) {
      console.error('Error tracking shipment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /shiprocket/shipments/cancel
   * Cancel shipment
   */
  app.post('/make-server-3dd53475/shiprocket/shipments/cancel', async (c) => {
    try {
      const { orderIds } = await c.req.json();
      const result = await cancelShipment(orderIds);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error cancelling shipment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /shiprocket/webhook
   * Handle Shiprocket webhooks
   */
  app.post('/make-server-3dd53475/shiprocket/webhook', async (c) => {
    try {
      const body = await c.req.json();
      
      console.log('📦 Shiprocket webhook received:', body.event);
      
      // Handle different webhook events
      switch (body.event) {
        case 'ORDER_SHIPPED':
          console.log('✅ Order shipped:', body.order_id);
          break;
          
        case 'ORDER_DELIVERED':
          console.log('✅ Order delivered:', body.order_id);
          break;
          
        case 'ORDER_CANCELLED':
          console.log('❌ Order cancelled:', body.order_id);
          break;
          
        case 'ORDER_RTO':
          console.log('🔄 Order RTO:', body.order_id);
          break;
      }
      
      return c.json({ success: true });
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Shiprocket endpoints registered');
}
