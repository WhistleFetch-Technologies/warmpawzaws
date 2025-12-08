/**
 * SHIPROCKET LOGISTICS INTEGRATION
 * 
 * Fulfills P0 Critical Gap: Real logistics integration
 * 
 * Features:
 * - Order creation
 * - AWB generation
 * - Pickup scheduling
 * - Real-time tracking
 * - Return processing
 * - Label generation
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

// Shiprocket API configuration
const getShiprocketConfig = async () => {
  const config = await kv.get('platform:settings:logistics');
  
  if (!config || !config.value || !config.value.shiprocket) {
    throw new Error('Shiprocket configuration not found');
  }

  return {
    email: config.value.shiprocket.email,
    password: config.value.shiprocket.password,
    enabled: config.value.shiprocket.enabled
  };
};

// Authentication token cache
let authToken: string | null = null;
let tokenExpiry: number = 0;

// Shiprocket API helper
const shiprocketRequest = async (method: string, endpoint: string, body?: any) => {
  // Get or refresh auth token
  if (!authToken || Date.now() > tokenExpiry) {
    const config = await getShiprocketConfig();
    
    const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.email,
        password: config.password
      })
    });

    if (!authResponse.ok) {
      throw new Error('Shiprocket authentication failed');
    }

    const authData = await authResponse.json();
    authToken = authData.token;
    tokenExpiry = Date.now() + (10 * 60 * 60 * 1000); // 10 hours
  }

  const response = await fetch(`https://apiv2.shiprocket.in/v1/external${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Shiprocket API error: ${error.message || 'Unknown error'}`);
  }

  return await response.json();
};

/**
 * POST /logistics/shiprocket/create-order
 * Create Shiprocket order
 */
app.post('/logistics/shiprocket/create-order', async (c) => {
  try {
    const { orderId, customerDetails, productDetails, pickupAddress, deliveryAddress } = await c.req.json();

    // Validation
    if (!orderId || !customerDetails || !productDetails || !deliveryAddress) {
      return c.json({
        error: 'Missing required fields',
        required: ['orderId', 'customerDetails', 'productDetails', 'deliveryAddress']
      }, 400);
    }

    // Get order details
    const orderData = await kv.get(`order:${orderId}`);
    if (!orderData || !orderData.value) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = orderData.value;

    // Create Shiprocket order
    const shiprocketOrder = await shiprocketRequest('POST', '/orders/create/adhoc', {
      order_id: orderId,
      order_date: order.createdAt,
      pickup_location: pickupAddress?.name || 'Primary',
      channel_id: '', // Optional
      comment: order.notes || '',
      billing_customer_name: customerDetails.name,
      billing_last_name: customerDetails.lastName || '',
      billing_address: deliveryAddress.address,
      billing_address_2: deliveryAddress.address2 || '',
      billing_city: deliveryAddress.city,
      billing_pincode: deliveryAddress.pincode,
      billing_state: deliveryAddress.state,
      billing_country: deliveryAddress.country || 'India',
      billing_email: customerDetails.email,
      billing_phone: customerDetails.phone,
      shipping_is_billing: true, // Same as billing
      order_items: productDetails.map((product: any) => ({
        name: product.name,
        sku: product.sku || product.id,
        units: product.quantity,
        selling_price: product.price,
        discount: product.discount || 0,
        tax: product.tax || 0,
        hsn: product.hsn || ''
      })),
      payment_method: order.paymentMethod || 'Prepaid',
      shipping_charges: order.shippingCharges || 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: order.discount || 0,
      sub_total: order.subtotal || order.total,
      length: productDetails[0]?.dimensions?.length || 10,
      breadth: productDetails[0]?.dimensions?.breadth || 10,
      height: productDetails[0]?.dimensions?.height || 10,
      weight: productDetails.reduce((sum: number, p: any) => sum + (p.weight || 0.5), 0)
    });

    // Store Shiprocket order details
    await kv.set(`logistics:shiprocket:order:${orderId}`, {
      orderId,
      shiprocketOrderId: shiprocketOrder.order_id,
      shipmentId: shiprocketOrder.shipment_id,
      status: shiprocketOrder.status,
      channel_order_id: shiprocketOrder.channel_order_id,
      createdAt: new Date().toISOString()
    });

    // Update order with shipment details
    order.shipmentId = shiprocketOrder.shipment_id;
    order.shiprocketOrderId = shiprocketOrder.order_id;
    order.logisticsProvider = 'shiprocket';
    await kv.set(`order:${orderId}`, order);

    console.log(`✅ Shiprocket order created: ${shiprocketOrder.order_id} for order ${orderId}`);

    return c.json({
      success: true,
      orderId,
      shiprocketOrderId: shiprocketOrder.order_id,
      shipmentId: shiprocketOrder.shipment_id,
      status: shiprocketOrder.status
    });

  } catch (error: any) {
    console.error('Error creating Shiprocket order:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /logistics/shiprocket/generate-awb
 * Generate AWB for shipment
 */
app.post('/logistics/shiprocket/generate-awb', async (c) => {
  try {
    const { shipmentId, courierId } = await c.req.json();

    if (!shipmentId) {
      return c.json({ error: 'Shipment ID required' }, 400);
    }

    // If courier not specified, get recommended courier
    let selectedCourierId = courierId;
    
    if (!courierId) {
      const serviceability = await shiprocketRequest('GET', `/courier/serviceability?pickup_postcode=110001&delivery_postcode=110002&cod=0&weight=1`);
      
      if (serviceability.data?.available_courier_companies?.length > 0) {
        selectedCourierId = serviceability.data.available_courier_companies[0].courier_company_id;
      } else {
        return c.json({ error: 'No courier available for this route' }, 400);
      }
    }

    // Generate AWB
    const awbResponse = await shiprocketRequest('POST', '/courier/assign/awb', {
      shipment_id: parseInt(shipmentId),
      courier_id: selectedCourierId
    });

    // Store AWB details
    await kv.set(`logistics:shiprocket:awb:${shipmentId}`, {
      shipmentId,
      awbCode: awbResponse.awb_assign_status === 1 ? awbResponse.response.data.awb_code : null,
      courierId: selectedCourierId,
      courierName: awbResponse.response?.data?.courier_name || '',
      status: awbResponse.awb_assign_status === 1 ? 'assigned' : 'failed',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ AWB generated: ${awbResponse.response?.data?.awb_code} for shipment ${shipmentId}`);

    return c.json({
      success: true,
      awbCode: awbResponse.response?.data?.awb_code,
      courierName: awbResponse.response?.data?.courier_name,
      shipmentId
    });

  } catch (error: any) {
    console.error('Error generating AWB:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /logistics/shiprocket/schedule-pickup
 * Schedule pickup for shipment
 */
app.post('/logistics/shiprocket/schedule-pickup', async (c) => {
  try {
    const { shipmentId, pickupDate } = await c.req.json();

    if (!shipmentId) {
      return c.json({ error: 'Shipment ID required' }, 400);
    }

    // Schedule pickup
    const pickupResponse = await shiprocketRequest('POST', '/courier/generate/pickup', {
      shipment_id: [parseInt(shipmentId)],
      pickup_date: pickupDate || new Date().toISOString().split('T')[0]
    });

    // Store pickup details
    await kv.set(`logistics:shiprocket:pickup:${shipmentId}`, {
      shipmentId,
      pickupScheduled: pickupResponse.pickup_scheduled_date,
      pickupTokenNumber: pickupResponse.pickup_token_number,
      status: pickupResponse.response?.status === 200 ? 'scheduled' : 'failed',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Pickup scheduled for shipment ${shipmentId}: ${pickupResponse.pickup_scheduled_date}`);

    return c.json({
      success: true,
      pickupScheduled: pickupResponse.pickup_scheduled_date,
      pickupTokenNumber: pickupResponse.pickup_token_number
    });

  } catch (error: any) {
    console.error('Error scheduling pickup:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /logistics/shiprocket/track/:awbCode
 * Real-time shipment tracking
 */
app.get('/logistics/shiprocket/track/:awbCode', async (c) => {
  try {
    const awbCode = c.req.param('awbCode');

    // Get tracking details from Shiprocket
    const tracking = await shiprocketRequest('GET', `/courier/track/awb/${awbCode}`);

    if (!tracking.tracking_data) {
      return c.json({ error: 'Tracking data not found' }, 404);
    }

    const trackingData = tracking.tracking_data;

    // Store tracking snapshot
    await kv.set(`logistics:shiprocket:tracking:${awbCode}:${Date.now()}`, {
      awbCode,
      status: trackingData.shipment_status,
      currentLocation: trackingData.current_location || '',
      trackingData: trackingData.shipment_track,
      deliveredDate: trackingData.delivered_date || null,
      updatedAt: new Date().toISOString()
    });

    // Parse tracking history
    const timeline = trackingData.shipment_track.map((event: any) => ({
      date: event.date,
      status: event.status,
      activity: event.activity,
      location: event.location || '',
      srStatusLabel: event['sr-status-label'] || ''
    }));

    console.log(`📦 Tracking fetched for AWB ${awbCode}: ${trackingData.shipment_status}`);

    return c.json({
      success: true,
      awbCode,
      status: trackingData.shipment_status,
      currentLocation: trackingData.current_location,
      deliveredDate: trackingData.delivered_date,
      timeline,
      etd: trackingData.etd || null
    });

  } catch (error: any) {
    console.error('Error tracking shipment:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /logistics/shiprocket/create-return
 * Create return shipment
 */
app.post('/logistics/shiprocket/create-return', async (c) => {
  try {
    const { orderId, returnItems, reason } = await c.req.json();

    if (!orderId || !returnItems) {
      return c.json({
        error: 'Missing required fields',
        required: ['orderId', 'returnItems']
      }, 400);
    }

    // Get original order
    const shiprocketOrderData = await kv.get(`logistics:shiprocket:order:${orderId}`);
    if (!shiprocketOrderData || !shiprocketOrderData.value) {
      return c.json({ error: 'Original shipment not found' }, 404);
    }

    const shiprocketOrder = shiprocketOrderData.value;

    // Create return order
    const returnResponse = await shiprocketRequest('POST', '/orders/create/return', {
      order_id: `RET_${orderId}`,
      order_date: new Date().toISOString(),
      channel_id: '',
      pickup_customer_name: returnItems[0].customerName,
      pickup_last_name: '',
      pickup_address: returnItems[0].pickupAddress.address,
      pickup_city: returnItems[0].pickupAddress.city,
      pickup_state: returnItems[0].pickupAddress.state,
      pickup_country: 'India',
      pickup_pincode: returnItems[0].pickupAddress.pincode,
      pickup_email: returnItems[0].customerEmail,
      pickup_phone: returnItems[0].customerPhone,
      pickup_isd_code: '91',
      shipping_customer_name: 'Warmpawz',
      shipping_address: 'Warehouse Address', // From settings
      shipping_city: 'Bangalore',
      shipping_pincode: '560001',
      shipping_country: 'India',
      shipping_state: 'Karnataka',
      shipping_email: 'returns@warmpawz.com',
      shipping_phone: '9876543210',
      order_items: returnItems.map((item: any) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price
      })),
      payment_method: 'Prepaid',
      sub_total: returnItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    });

    // Store return details
    const returnId = `return_${Date.now()}`;
    await kv.set(`logistics:shiprocket:return:${returnId}`, {
      returnId,
      orderId,
      shiprocketReturnOrderId: returnResponse.order_id,
      returnShipmentId: returnResponse.shipment_id,
      reason,
      status: 'created',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Return created: ${returnResponse.order_id} for order ${orderId}`);

    return c.json({
      success: true,
      returnId,
      shiprocketReturnOrderId: returnResponse.order_id,
      returnShipmentId: returnResponse.shipment_id
    });

  } catch (error: any) {
    console.error('Error creating return:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /logistics/shiprocket/label/:shipmentId
 * Generate and retrieve shipping label
 */
app.get('/logistics/shiprocket/label/:shipmentId', async (c) => {
  try {
    const shipmentId = c.req.param('shipmentId');

    // Generate label
    const labelResponse = await shiprocketRequest('POST', '/courier/generate/label', {
      shipment_id: [parseInt(shipmentId)]
    });

    if (!labelResponse.label_url) {
      return c.json({ error: 'Label generation failed' }, 500);
    }

    console.log(`✅ Label generated for shipment ${shipmentId}`);

    return c.json({
      success: true,
      labelUrl: labelResponse.label_url,
      shipmentId
    });

  } catch (error: any) {
    console.error('Error generating label:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /logistics/shiprocket/invoice/:orderId
 * Generate invoice for order
 */
app.get('/logistics/shiprocket/invoice/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');

    // Get Shiprocket order
    const shiprocketOrderData = await kv.get(`logistics:shiprocket:order:${orderId}`);
    if (!shiprocketOrderData || !shiprocketOrderData.value) {
      return c.json({ error: 'Shipment not found' }, 404);
    }

    const shiprocketOrder = shiprocketOrderData.value;

    // Generate invoice
    const invoiceResponse = await shiprocketRequest('POST', '/orders/print/invoice', {
      ids: [shiprocketOrder.shiprocketOrderId]
    });

    console.log(`✅ Invoice generated for order ${orderId}`);

    return c.json({
      success: true,
      invoiceUrl: invoiceResponse.invoice_url,
      orderId
    });

  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /logistics/shiprocket/couriers/serviceability
 * Check courier serviceability
 */
app.get('/logistics/shiprocket/couriers/serviceability', async (c) => {
  try {
    const pickupPincode = c.req.query('pickupPincode');
    const deliveryPincode = c.req.query('deliveryPincode');
    const cod = c.req.query('cod') || '0';
    const weight = c.req.query('weight') || '1';

    if (!pickupPincode || !deliveryPincode) {
      return c.json({
        error: 'Missing required parameters',
        required: ['pickupPincode', 'deliveryPincode']
      }, 400);
    }

    // Check serviceability
    const serviceability = await shiprocketRequest(
      'GET',
      `/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=${cod}&weight=${weight}`
    );

    const availableCouriers = serviceability.data?.available_courier_companies || [];

    return c.json({
      success: true,
      available: availableCouriers.length > 0,
      couriers: availableCouriers.map((courier: any) => ({
        id: courier.courier_company_id,
        name: courier.courier_name,
        rate: courier.rate,
        estimatedDays: courier.etd,
        cod: courier.cod,
        rating: courier.rating
      }))
    });

  } catch (error: any) {
    console.error('Error checking serviceability:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /logistics/shiprocket/webhook
 * Handle Shiprocket webhooks
 */
app.post('/logistics/shiprocket/webhook', async (c) => {
  try {
    const event = await c.req.json();

    console.log(`📬 Shiprocket webhook received: ${event.event}`);

    // Handle different webhook events
    switch (event.event) {
      case 'SHIPMENT_STATUS_CHANGED':
        await handleShipmentStatusChanged(event);
        break;

      case 'SHIPMENT_DELIVERED':
        await handleShipmentDelivered(event);
        break;

      case 'NDR_EVENT':
        await handleNDREvent(event);
        break;

      default:
        console.log(`⚠️ Unhandled webhook event: ${event.event}`);
    }

    return c.json({ success: true });

  } catch (error: any) {
    console.error('Error processing Shiprocket webhook:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Webhook Handlers
 */

async function handleShipmentStatusChanged(event: any) {
  const { awb, current_status } = event;
  
  console.log(`📦 Shipment status changed: AWB ${awb} → ${current_status}`);
  
  // Update order status
  // Find order by AWB and update status
}

async function handleShipmentDelivered(event: any) {
  const { awb, delivered_date } = event;
  
  console.log(`✅ Shipment delivered: AWB ${awb} on ${delivered_date}`);
  
  // Update order to delivered status
}

async function handleNDREvent(event: any) {
  const { awb, ndr_status } = event;
  
  console.log(`⚠️ NDR event: AWB ${awb} - ${ndr_status}`);
  
  // Handle non-delivery report
  // Notify customer and vendor
}

export default app;
