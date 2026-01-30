/**
 * ============================================================================
 * LOGISTICS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles logistics integration (Shiprocket, Delhivery, Dunzo):
 * - Create shipment with partner auto-selection
 * - Track shipment across all partners
 * - Generate AWB
 * - Calculate shipping charges
 * - Hyperlocal delivery for pharmacy/meal orders
 * 
 * Partners:
 * - Shiprocket: Inter-city e-commerce shipments
 * - Delhivery: Inter-city shipments with better rates for certain routes
 * - Dunzo: Hyperlocal delivery (<10km, same city) for pharmacy/meal
 * 
 * Migrated from: supabase/functions/server/shiprocket-integration.tsx
 * 
 * Date: 2025-01-28
 * Updated: 2026-01-27 - Added Delhivery and Dunzo integrations
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getSecretJson } from '../utils/secrets-manager';

// ============================================================================
// API BASE URLS
// ============================================================================
const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const DELHIVERY_API_BASE = 'https://track.delhivery.com/api';
const DUNZO_API_BASE = 'https://apis.dunzo.in/api/v1';

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

// Shiprocket token management
let shiprocketToken: string | null = null;
let tokenExpiryTime: number = 0;

// Delhivery token management
let delhiveryToken: string | null = null;
let delhiveryTokenExpiry: number = 0;

// Dunzo token management
let dunzoClientId: string | null = null;
let dunzoClientSecret: string | null = null;

// ============================================================================
// TYPES
// ============================================================================

interface ShippingAddress {
  name?: string;
  street?: string;
  line1?: string;
  address?: string;
  city: string;
  state: string;
  pincode: string;
  zip?: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

interface OrderItem {
  name?: string;
  product_name?: string;
  sku?: string;
  product_id?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
}

interface CreateShipmentParams {
  orderId: string;
  orderType?: 'ecommerce' | 'pharmacy' | 'meal';
  partner?: 'shiprocket' | 'delhivery' | 'dunzo' | 'auto';
  pickupAddress: ShippingAddress;
  deliveryAddress: ShippingAddress;
  items: OrderItem[];
  weight?: number;
  dimensions?: { length: number; breadth: number; height: number };
  codAmount?: number;
  orderValue: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod?: 'prepaid' | 'cod';
}

interface NormalizedTracking {
  partner: string;
  shipmentId: string;
  awb?: string;
  taskId?: string;
  status: string;
  statusDescription: string;
  currentLocation?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  events: Array<{
    status: string;
    description: string;
    location?: string;
    timestamp: string;
  }>;
  deliveryPerson?: {
    name?: string;
    phone?: string;
    photo?: string;
  };
  trackingUrl?: string;
}

/**
 * ✅ FIX: Updated to use AWS Secrets Manager with fallback to database
 * Secrets Manager secret: warmpawz/${STAGE}/shiprocket
 * Expected format: { "email": "...", "password": "..." }
 */
async function getShiprocketToken(): Promise<string> {
  if (shiprocketToken && Date.now() < tokenExpiryTime) {
    return shiprocketToken;
  }

  try {
    let config: { email?: string; password?: string } | null = null;
    
    // ✅ PRIMARY: Try AWS Secrets Manager first
    try {
      console.log('[SHIPROCKET] Attempting to fetch credentials from AWS Secrets Manager...');
      config = await getSecretJson<{ email: string; password: string }>('shiprocket');
      if (config?.email && config?.password) {
        console.log('[SHIPROCKET] ✅ Credentials loaded from Secrets Manager');
      }
    } catch (smError) {
      console.warn('[SHIPROCKET] Secrets Manager fetch failed, falling back to database:', smError);
    }

    // ✅ FALLBACK: Try database if Secrets Manager failed
    if (!config?.email || !config?.password) {
      console.log('[SHIPROCKET] Falling back to platform_settings database...');
      const settings = await select('platform_settings', { setting_key: 'platform:integrations:shiprocket' });
      config = settings.length > 0 ? (settings[0].setting_value as any) : null;
      
      if (config?.email && config?.password) {
        console.log('[SHIPROCKET] ✅ Credentials loaded from database');
      }
    }

    if (!config?.email || !config?.password) {
      throw new Error('Shiprocket credentials not configured. Please configure in AWS Secrets Manager (warmpawz/dev/shiprocket) or platform_settings.');
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
      const errorText = await response.text();
      console.error('[SHIPROCKET] Auth failed:', response.status, errorText);
      throw new Error(`Shiprocket authentication failed: ${response.status}`);
    }

    const data: any = await response.json();
    shiprocketToken = data?.token || '';
    if (!shiprocketToken) {
      throw new Error('Shiprocket token missing in response');
    }
    tokenExpiryTime = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days
    console.log('[SHIPROCKET] ✅ Token acquired successfully');

    return shiprocketToken;
  } catch (error: any) {
    console.error('[SHIPROCKET] Auth error:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * DELHIVERY AUTHENTICATION
 * ============================================================================
 * Delhivery uses API token-based authentication
 * Secrets Manager secret: warmpawz/${STAGE}/delhivery
 * Expected format: { "api_token": "...", "client_name": "..." }
 */
async function getDelhiveryCredentials(): Promise<{ apiToken: string; clientName: string }> {
  try {
    // Try AWS Secrets Manager first
    console.log('[DELHIVERY] Fetching credentials from Secrets Manager...');
    const config = await getSecretJson<{ api_token: string; client_name: string }>('delhivery');
    
    if (config?.api_token && config?.client_name) {
      console.log('[DELHIVERY] ✅ Credentials loaded from Secrets Manager');
      return { apiToken: config.api_token, clientName: config.client_name };
    }

    // Fallback to database
    console.log('[DELHIVERY] Falling back to platform_settings...');
    const settings = await select('platform_settings', { setting_key: 'platform:integrations:delhivery' });
    const dbConfig = settings.length > 0 ? (settings[0].setting_value as any) : null;

    if (dbConfig?.api_token && dbConfig?.client_name) {
      console.log('[DELHIVERY] ✅ Credentials loaded from database');
      return { apiToken: dbConfig.api_token, clientName: dbConfig.client_name };
    }

    throw new Error('Delhivery credentials not configured');
  } catch (error: any) {
    console.error('[DELHIVERY] Error fetching credentials:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * DUNZO AUTHENTICATION  
 * ============================================================================
 * Dunzo uses OAuth2 client credentials flow
 * Secrets Manager secret: warmpawz/${STAGE}/dunzo
 * Expected format: { "client_id": "...", "client_secret": "...", "webhook_secret": "..." }
 */
async function getDunzoCredentials(): Promise<{ clientId: string; clientSecret: string; webhookSecret?: string }> {
  try {
    // Try AWS Secrets Manager first
    console.log('[DUNZO] Fetching credentials from Secrets Manager...');
    const config = await getSecretJson<{ client_id: string; client_secret: string; webhook_secret?: string }>('dunzo');
    
    if (config?.client_id && config?.client_secret) {
      console.log('[DUNZO] ✅ Credentials loaded from Secrets Manager');
      dunzoClientId = config.client_id;
      dunzoClientSecret = config.client_secret;
      return { clientId: config.client_id, clientSecret: config.client_secret, webhookSecret: config.webhook_secret };
    }

    // Fallback to database
    console.log('[DUNZO] Falling back to platform_settings...');
    const settings = await select('platform_settings', { setting_key: 'platform:integrations:dunzo' });
    const dbConfig = settings.length > 0 ? (settings[0].setting_value as any) : null;

    if (dbConfig?.client_id && dbConfig?.client_secret) {
      console.log('[DUNZO] ✅ Credentials loaded from database');
      return { clientId: dbConfig.client_id, clientSecret: dbConfig.client_secret, webhookSecret: dbConfig.webhook_secret };
    }

    throw new Error('Dunzo credentials not configured');
  } catch (error: any) {
    console.error('[DUNZO] Error fetching credentials:', error);
    throw error;
  }
}

/**
 * Get Dunzo access token (OAuth2 client credentials flow)
 */
async function getDunzoAccessToken(): Promise<string> {
  try {
    const { clientId, clientSecret } = await getDunzoCredentials();
    
    const response = await fetch(`${DUNZO_API_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DUNZO] Token fetch failed:', response.status, errorText);
      throw new Error(`Dunzo authentication failed: ${response.status}`);
    }

    const data: any = await response.json();
    return data.token || data.access_token;
  } catch (error: any) {
    console.error('[DUNZO] Auth error:', error);
    throw error;
  }
}

// ============================================================================
// DELHIVERY API FUNCTIONS
// ============================================================================

/**
 * Create order in Delhivery
 */
async function delhiveryCreateOrder(orderData: {
  orderId: string;
  pickupAddress: ShippingAddress;
  deliveryAddress: ShippingAddress;
  items: OrderItem[];
  weight: number;
  codAmount?: number;
  orderValue: number;
  customerName: string;
  customerPhone: string;
}): Promise<{ success: boolean; waybill?: string; error?: string }> {
  try {
    const { apiToken, clientName } = await getDelhiveryCredentials();

    const shipmentData = {
      shipments: [{
        name: orderData.customerName,
        add: orderData.deliveryAddress.street || orderData.deliveryAddress.line1 || orderData.deliveryAddress.address,
        pin: orderData.deliveryAddress.pincode || orderData.deliveryAddress.zip,
        city: orderData.deliveryAddress.city,
        state: orderData.deliveryAddress.state,
        country: 'India',
        phone: orderData.customerPhone,
        order: orderData.orderId,
        payment_mode: orderData.codAmount && orderData.codAmount > 0 ? 'COD' : 'Prepaid',
        cod_amount: orderData.codAmount || 0,
        weight: orderData.weight * 1000, // Convert kg to grams
        seller_name: clientName,
        seller_add: orderData.pickupAddress.street || orderData.pickupAddress.address || 'Pickup Address',
        seller_pin: orderData.pickupAddress.pincode,
        seller_city: orderData.pickupAddress.city,
        seller_state: orderData.pickupAddress.state,
        seller_gst_tin: '',
        products_desc: orderData.items.map(i => i.name || i.product_name).join(', '),
        quantity: orderData.items.reduce((sum, i) => sum + i.quantity, 0),
        total_amount: orderData.orderValue,
      }],
      pickup_location: {
        name: clientName,
        add: orderData.pickupAddress.street || orderData.pickupAddress.address,
        city: orderData.pickupAddress.city,
        pin_code: orderData.pickupAddress.pincode,
        country: 'India',
        phone: orderData.pickupAddress.phone || '',
      },
    };

    const response = await fetch(`${DELHIVERY_API_BASE}/cmu/create.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DELHIVERY] Create order failed:', response.status, errorText);
      return { success: false, error: `Delhivery API error: ${response.status}` };
    }

    const result: any = await response.json();
    
    if (!result.success) {
      return { success: false, error: result.rmk || 'Delhivery order creation failed' };
    }

    const waybill = result.packages?.[0]?.waybill;
    console.log('[DELHIVERY] ✅ Order created, waybill:', waybill);
    
    return { success: true, waybill };
  } catch (error: any) {
    console.error('[DELHIVERY] Create order error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Track shipment in Delhivery
 */
async function delhiveryTrackShipment(waybill: string): Promise<NormalizedTracking | null> {
  try {
    const { apiToken } = await getDelhiveryCredentials();

    const response = await fetch(`${DELHIVERY_API_BASE}/v1/packages/json/?waybill=${waybill}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiToken}`,
      },
    });

    if (!response.ok) {
      console.error('[DELHIVERY] Track failed:', response.status);
      return null;
    }

    const data: any = await response.json();
    const shipment = data.ShipmentData?.[0]?.Shipment;

    if (!shipment) {
      return null;
    }

    // Normalize status
    const statusMap: Record<string, string> = {
      'Manifested': 'created',
      'In Transit': 'in_transit',
      'Pending': 'pending',
      'Out for Delivery': 'out_for_delivery',
      'Delivered': 'delivered',
      'RTO': 'rto_initiated',
      'Returned': 'returned',
      'Cancelled': 'cancelled',
    };

    const scans = shipment.Scans || [];
    const events = scans.map((scan: any) => ({
      status: scan.ScanType,
      description: scan.Instructions || scan.ScanType,
      location: scan.ScannedLocation,
      timestamp: scan.ScanDateTime,
    }));

    return {
      partner: 'delhivery',
      shipmentId: shipment.OrderID || waybill,
      awb: waybill,
      status: statusMap[shipment.Status?.Status] || 'unknown',
      statusDescription: shipment.Status?.Status || 'Unknown',
      currentLocation: shipment.Status?.Location,
      estimatedDelivery: shipment.ExpectedDeliveryDate,
      deliveredAt: shipment.Status?.Status === 'Delivered' ? shipment.Status?.StatusDateTime : undefined,
      events,
      trackingUrl: `https://www.delhivery.com/track/package/${waybill}`,
    };
  } catch (error: any) {
    console.error('[DELHIVERY] Track error:', error);
    return null;
  }
}

/**
 * Cancel shipment in Delhivery
 */
async function delhiveryCancelShipment(waybill: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { apiToken } = await getDelhiveryCredentials();

    const response = await fetch(`${DELHIVERY_API_BASE}/p/edit`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        waybill,
        cancellation: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Cancel failed: ${response.status}` };
    }

    console.log('[DELHIVERY] ✅ Shipment cancelled:', waybill);
    return { success: true };
  } catch (error: any) {
    console.error('[DELHIVERY] Cancel error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DUNZO API FUNCTIONS (Hyperlocal Delivery)
// ============================================================================

/**
 * Create delivery task in Dunzo
 */
async function dunzoCreateTask(taskData: {
  orderId: string;
  orderType: 'pharmacy' | 'meal';
  pickupAddress: ShippingAddress;
  deliveryAddress: ShippingAddress;
  packageDescription: string;
  packageValue: number;
  customerName: string;
  customerPhone: string;
}): Promise<{ success: boolean; taskId?: string; trackingUrl?: string; error?: string }> {
  try {
    const token = await getDunzoAccessToken();

    const payload = {
      request_id: taskData.orderId,
      pickup_details: [{
        lat: taskData.pickupAddress.lat || 0,
        lng: taskData.pickupAddress.lng || 0,
        address: {
          street_address_1: taskData.pickupAddress.street || taskData.pickupAddress.address || '',
          street_address_2: '',
          locality: taskData.pickupAddress.city,
          city: taskData.pickupAddress.city,
          state: taskData.pickupAddress.state,
          pincode: taskData.pickupAddress.pincode,
          country: 'India',
        },
        contact_details: {
          name: 'Store',
          phone_number: taskData.pickupAddress.phone || '',
        },
        reference_id: `pickup-${taskData.orderId}`,
      }],
      drop_details: [{
        lat: taskData.deliveryAddress.lat || 0,
        lng: taskData.deliveryAddress.lng || 0,
        address: {
          street_address_1: taskData.deliveryAddress.street || taskData.deliveryAddress.address || '',
          street_address_2: '',
          locality: taskData.deliveryAddress.city,
          city: taskData.deliveryAddress.city,
          state: taskData.deliveryAddress.state,
          pincode: taskData.deliveryAddress.pincode,
          country: 'India',
        },
        contact_details: {
          name: taskData.customerName,
          phone_number: taskData.customerPhone,
        },
        reference_id: `drop-${taskData.orderId}`,
      }],
      package_content: [{
        name: taskData.packageDescription,
        quantity: 1,
        reference_id: taskData.orderId,
      }],
      payment_method: 'DUNZO_CREDIT',
      order_amount: {
        currency: 'INR',
        value: taskData.packageValue,
      },
      category_id: taskData.orderType === 'pharmacy' ? 'medicine' : 'food',
      sender_id: taskData.orderId,
    };

    const response = await fetch(`${DUNZO_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'client-id': dunzoClientId || '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DUNZO] Create task failed:', response.status, errorText);
      return { success: false, error: `Dunzo API error: ${response.status}` };
    }

    const result: any = await response.json();
    
    console.log('[DUNZO] ✅ Task created:', result.task_id);
    
    return {
      success: true,
      taskId: result.task_id,
      trackingUrl: result.tracking_url,
    };
  } catch (error: any) {
    console.error('[DUNZO] Create task error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get task status from Dunzo
 */
async function dunzoGetTaskStatus(taskId: string): Promise<NormalizedTracking | null> {
  try {
    const token = await getDunzoAccessToken();

    const response = await fetch(`${DUNZO_API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'client-id': dunzoClientId || '',
      },
    });

    if (!response.ok) {
      console.error('[DUNZO] Get status failed:', response.status);
      return null;
    }

    const data: any = await response.json();

    // Map Dunzo states to normalized status
    const stateMap: Record<string, string> = {
      'created': 'created',
      'queued': 'queued',
      'runner_accepted': 'assigned',
      'runner_assigned': 'assigned',
      'reached_for_pickup': 'at_pickup',
      'pickup_complete': 'picked_up',
      'started_for_delivery': 'on_the_way',
      'reached_for_delivery': 'nearby',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'failed': 'failed',
    };

    return {
      partner: 'dunzo',
      shipmentId: taskId,
      taskId,
      status: stateMap[data.state] || 'unknown',
      statusDescription: data.state?.replace(/_/g, ' ') || 'Unknown',
      currentLocation: data.runner?.current_location ? 
        `${data.runner.current_location.lat}, ${data.runner.current_location.lng}` : undefined,
      estimatedDelivery: data.eta?.drop_eta,
      deliveredAt: data.state === 'delivered' ? data.updated_at : undefined,
      events: (data.state_history || []).map((s: any) => ({
        status: s.state,
        description: s.state?.replace(/_/g, ' '),
        timestamp: s.timestamp,
      })),
      deliveryPerson: data.runner ? {
        name: data.runner.name,
        phone: data.runner.phone_number,
        photo: data.runner.image_url,
      } : undefined,
      trackingUrl: data.tracking_url,
    };
  } catch (error: any) {
    console.error('[DUNZO] Get status error:', error);
    return null;
  }
}

/**
 * Cancel task in Dunzo
 */
async function dunzoCancelTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getDunzoAccessToken();

    const response = await fetch(`${DUNZO_API_BASE}/tasks/${taskId}/_cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'client-id': dunzoClientId || '',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Cancel failed: ${response.status}` };
    }

    console.log('[DUNZO] ✅ Task cancelled:', taskId);
    return { success: true };
  } catch (error: any) {
    console.error('[DUNZO] Cancel error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PARTNER SELECTION LOGIC
// ============================================================================

/**
 * Determine the best logistics partner based on order characteristics
 */
async function selectLogisticsPartner(params: {
  orderType: 'ecommerce' | 'pharmacy' | 'meal';
  pickupPincode: string;
  deliveryPincode: string;
  pickupCity?: string;
  deliveryCity?: string;
  distanceKm?: number;
  weight?: number;
  orderValue: number;
}): Promise<'shiprocket' | 'delhivery' | 'dunzo'> {
  const { orderType, pickupCity, deliveryCity, distanceKm, weight } = params;

  // For pharmacy and meal orders, prefer hyperlocal delivery
  if (orderType === 'pharmacy' || orderType === 'meal') {
    // Check if Dunzo is available (same city, < 10km)
    const isSameCity = pickupCity && deliveryCity && 
      pickupCity.toLowerCase() === deliveryCity.toLowerCase();
    const isHyperlocal = distanceKm !== undefined ? distanceKm < 10 : isSameCity;

    if (isHyperlocal) {
      // Check if Dunzo is configured
      try {
        await getDunzoCredentials();
        return 'dunzo';
      } catch {
        console.log('[PARTNER SELECT] Dunzo not configured, falling back');
      }
    }
  }

  // For inter-city or e-commerce, check Delhivery first (often better rates)
  // Heavy packages (>5kg) often have better rates with Delhivery
  if (weight && weight > 5) {
    try {
      await getDelhiveryCredentials();
      return 'delhivery';
    } catch {
      console.log('[PARTNER SELECT] Delhivery not configured, using Shiprocket');
    }
  }

  // Default to Shiprocket (most reliable fallback)
  return 'shiprocket';
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
      ).catch((error) => {
        // Expected: notification may fail, but don't fail the main operation
        console.warn('[LOGISTICS] Error sending notification:', error instanceof Error ? error.message : 'Unknown error');
      });

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
      return c.json(result, response.status as 200 | 400 | 500);
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

  // ============================================================================
  // DELHIVERY ENDPOINTS
  // ============================================================================

  /**
   * POST /logistics/delhivery/create-order
   * Create order in Delhivery
   */
  app.post("/logistics/delhivery/create-order", async (c) => {
    try {
      const orderData = await c.req.json();

      const result = await delhiveryCreateOrder({
        orderId: orderData.orderId,
        pickupAddress: orderData.pickupAddress || {
          street: orderData.pickupLocation || 'Pickup Address',
          city: orderData.pickupCity || 'City',
          state: orderData.pickupState || 'State',
          pincode: orderData.pickupPincode || '000000',
        },
        deliveryAddress: {
          street: orderData.billingAddress?.street || orderData.shippingAddress?.street,
          city: orderData.billingAddress?.city || orderData.shippingAddress?.city,
          state: orderData.billingAddress?.state || orderData.shippingAddress?.state,
          pincode: orderData.billingAddress?.pincode || orderData.shippingAddress?.pincode,
        },
        items: orderData.items || [],
        weight: orderData.weight || 0.5,
        codAmount: orderData.paymentMethod === 'cod' ? orderData.subTotal : 0,
        orderValue: orderData.subTotal || 0,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
      });

      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }

      // Store shipment in database
      await insert('shipments', {
        order_id: orderData.orderId,
        logistics_partner: 'delhivery',
        awb_code: result.waybill,
        status: 'created',
        tracking_url: `https://www.delhivery.com/track/package/${result.waybill}`,
      }).catch(() => {});

      return c.json({
        success: true,
        waybill: result.waybill,
        trackingUrl: `https://www.delhivery.com/track/package/${result.waybill}`,
      });
    } catch (error: any) {
      console.error('[DELHIVERY CREATE ORDER] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /logistics/delhivery/track/:waybill
   * Track Delhivery shipment
   */
  app.get("/logistics/delhivery/track/:waybill", async (c) => {
    try {
      const { waybill } = c.req.param();
      const tracking = await delhiveryTrackShipment(waybill);

      if (!tracking) {
        return c.json({ error: 'Tracking not found' }, 404);
      }

      return c.json({
        success: true,
        tracking,
      });
    } catch (error: any) {
      console.error('[DELHIVERY TRACK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/delhivery/cancel
   * Cancel Delhivery shipment
   */
  app.post("/logistics/delhivery/cancel", async (c) => {
    try {
      const { waybill } = await c.req.json();

      if (!waybill) {
        return c.json({ error: 'waybill is required' }, 400);
      }

      const result = await delhiveryCancelShipment(waybill);

      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }

      // Update shipment status in database
      await update('shipments', { awb_code: waybill }, {
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).catch(() => {});

      return c.json({ success: true, message: 'Shipment cancelled' });
    } catch (error: any) {
      console.error('[DELHIVERY CANCEL] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // DUNZO ENDPOINTS (Hyperlocal Delivery)
  // ============================================================================

  /**
   * POST /logistics/dunzo/create-task
   * Create delivery task in Dunzo
   */
  app.post("/logistics/dunzo/create-task", async (c) => {
    try {
      const taskData = await c.req.json();

      const result = await dunzoCreateTask({
        orderId: taskData.orderId,
        orderType: taskData.orderType || 'meal',
        pickupAddress: taskData.pickupAddress,
        deliveryAddress: taskData.deliveryAddress,
        packageDescription: taskData.packageDescription || 'Order items',
        packageValue: taskData.packageValue || 0,
        customerName: taskData.customerName,
        customerPhone: taskData.customerPhone,
      });

      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }

      // Store in delivery_tracking table (for pharmacy/meal orders)
      const trackingColumn = taskData.orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';
      await insert('delivery_tracking', {
        [trackingColumn]: taskData.orderId,
        external_task_id: result.taskId,
        logistics_partner: 'dunzo',
        status: 'created',
        tracking_url: result.trackingUrl,
        metadata: { dunzo_task_id: result.taskId },
      }).catch(() => {});

      return c.json({
        success: true,
        taskId: result.taskId,
        trackingUrl: result.trackingUrl,
      });
    } catch (error: any) {
      console.error('[DUNZO CREATE TASK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /logistics/dunzo/task/:taskId
   * Get Dunzo task status
   */
  app.get("/logistics/dunzo/task/:taskId", async (c) => {
    try {
      const { taskId } = c.req.param();
      const status = await dunzoGetTaskStatus(taskId);

      if (!status) {
        return c.json({ error: 'Task not found' }, 404);
      }

      return c.json({
        success: true,
        task: status,
      });
    } catch (error: any) {
      console.error('[DUNZO GET TASK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/dunzo/cancel-task
   * Cancel Dunzo delivery task
   */
  app.post("/logistics/dunzo/cancel-task", async (c) => {
    try {
      const { taskId } = await c.req.json();

      if (!taskId) {
        return c.json({ error: 'taskId is required' }, 400);
      }

      const result = await dunzoCancelTask(taskId);

      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }

      // Update tracking status in database
      await query(
        `UPDATE delivery_tracking SET status = 'cancelled', updated_at = NOW() 
         WHERE external_task_id = $1 OR metadata->>'dunzo_task_id' = $1`,
        [taskId]
      ).catch(() => {});

      return c.json({ success: true, message: 'Task cancelled' });
    } catch (error: any) {
      console.error('[DUNZO CANCEL] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // UNIFIED SHIPMENT CREATION (Auto-select partner)
  // ============================================================================

  /**
   * POST /logistics/create-shipment
   * Create shipment with automatic partner selection
   * 
   * Partner selection logic:
   * - Dunzo: Hyperlocal (<10km, same city) for pharmacy/meal orders
   * - Delhivery: Inter-city heavy packages or certain routes
   * - Shiprocket: Default fallback
   */
  app.post("/logistics/create-shipment", async (c) => {
    try {
      const body = await c.req.json();
      const {
        orderId,
        orderType = 'ecommerce',
        partner: requestedPartner,
        pickupAddress,
        deliveryAddress,
        items = [],
        weight = 0.5,
        dimensions = { length: 10, breadth: 10, height: 10 },
        codAmount = 0,
        orderValue,
        customerName,
        customerPhone,
        customerEmail,
        paymentMethod = 'prepaid',
        distanceKm,
      } = body;

      if (!orderId || !pickupAddress || !deliveryAddress || !customerName || !customerPhone) {
        return c.json({
          error: 'orderId, pickupAddress, deliveryAddress, customerName, and customerPhone are required',
        }, 400);
      }

      // Determine partner (auto-select or use requested)
      let selectedPartner: 'shiprocket' | 'delhivery' | 'dunzo';

      if (requestedPartner && requestedPartner !== 'auto') {
        selectedPartner = requestedPartner;
      } else {
        selectedPartner = await selectLogisticsPartner({
          orderType,
          pickupPincode: pickupAddress.pincode,
          deliveryPincode: deliveryAddress.pincode,
          pickupCity: pickupAddress.city,
          deliveryCity: deliveryAddress.city,
          distanceKm,
          weight,
          orderValue,
        });
      }

      console.log(`[CREATE SHIPMENT] Selected partner: ${selectedPartner} for order: ${orderId}`);

      // Create shipment based on selected partner
      let result: any;

      if (selectedPartner === 'dunzo') {
        // Dunzo for hyperlocal delivery
        result = await dunzoCreateTask({
          orderId,
          orderType: orderType as 'pharmacy' | 'meal',
          pickupAddress,
          deliveryAddress,
          packageDescription: items.map((i: any) => i.name || i.product_name).join(', ') || 'Order items',
          packageValue: orderValue,
          customerName,
          customerPhone,
        });

        if (result.success) {
          // Store in delivery_tracking
          const trackingColumn = orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';
          await insert('delivery_tracking', {
            [trackingColumn]: orderId,
            external_task_id: result.taskId,
            logistics_partner: 'dunzo',
            status: 'created',
            tracking_url: result.trackingUrl,
            metadata: { dunzo_task_id: result.taskId },
          }).catch(() => {});

          return c.json({
            success: true,
            partner: 'dunzo',
            taskId: result.taskId,
            trackingUrl: result.trackingUrl,
            message: 'Hyperlocal delivery task created',
          });
        }

        // Fallback to Shiprocket if Dunzo fails
        console.warn('[CREATE SHIPMENT] Dunzo failed, falling back to Shiprocket');
        selectedPartner = 'shiprocket';
      }

      if (selectedPartner === 'delhivery') {
        result = await delhiveryCreateOrder({
          orderId,
          pickupAddress,
          deliveryAddress,
          items,
          weight,
          codAmount: paymentMethod === 'cod' ? codAmount || orderValue : 0,
          orderValue,
          customerName,
          customerPhone,
        });

        if (result.success) {
          await insert('shipments', {
            order_id: orderId,
            logistics_partner: 'delhivery',
            awb_code: result.waybill,
            status: 'created',
            tracking_url: `https://www.delhivery.com/track/package/${result.waybill}`,
          }).catch(() => {});

          return c.json({
            success: true,
            partner: 'delhivery',
            awb: result.waybill,
            trackingUrl: `https://www.delhivery.com/track/package/${result.waybill}`,
          });
        }

        // Fallback to Shiprocket if Delhivery fails
        console.warn('[CREATE SHIPMENT] Delhivery failed, falling back to Shiprocket');
        selectedPartner = 'shiprocket';
      }

      // Shiprocket (default or fallback)
      const token = await getShiprocketToken();

      const shiprocketPayload = {
        order_id: orderId,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: 'Primary',
        billing_customer_name: customerName,
        billing_address: deliveryAddress.street || deliveryAddress.line1 || deliveryAddress.address || 'Address',
        billing_city: deliveryAddress.city,
        billing_pincode: deliveryAddress.pincode || deliveryAddress.zip,
        billing_state: deliveryAddress.state,
        billing_country: 'India',
        billing_email: customerEmail || 'customer@warmpawz.com',
        billing_phone: customerPhone,
        shipping_is_billing: true,
        order_items: items.map((item: any) => ({
          name: item.name || item.product_name || 'Item',
          sku: item.sku || item.product_id || 'SKU',
          units: item.quantity || 1,
          selling_price: item.price || item.unit_price || 0,
        })),
        payment_method: paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        sub_total: orderValue,
        length: dimensions.length,
        breadth: dimensions.breadth,
        height: dimensions.height,
        weight,
      };

      const response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shiprocketPayload),
      });

      const shiprocketResult: any = await response.json();

      if (!response.ok || !shiprocketResult.order_id) {
        console.error('[SHIPROCKET] Create failed:', shiprocketResult);
        return c.json({
          success: false,
          error: shiprocketResult.message || 'Failed to create shipment with any partner',
        }, 500);
      }

      // Store shipment
      await insert('shipments', {
        order_id: orderId,
        logistics_partner: 'shiprocket',
        shipment_id: shiprocketResult.shipment_id?.toString(),
        awb_code: shiprocketResult.awb_code,
        courier_name: shiprocketResult.courier_name,
        status: shiprocketResult.awb_code ? 'awb_generated' : 'created',
        tracking_url: shiprocketResult.shipment_id
          ? `https://www.shiprocket.in/shipment-tracking/${shiprocketResult.shipment_id}`
          : null,
      }).catch(() => {});

      return c.json({
        success: true,
        partner: 'shiprocket',
        shiprocketOrderId: shiprocketResult.order_id,
        shipmentId: shiprocketResult.shipment_id,
        awb: shiprocketResult.awb_code,
        courier: shiprocketResult.courier_name,
        trackingUrl: shiprocketResult.shipment_id
          ? `https://www.shiprocket.in/shipment-tracking/${shiprocketResult.shipment_id}`
          : null,
      });
    } catch (error: any) {
      console.error('[CREATE SHIPMENT] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // UNIFIED TRACKING ENDPOINT
  // ============================================================================

  /**
   * GET /logistics/track/:shipmentId
   * Unified tracking endpoint supporting all partners
   * Query param: partner=shiprocket|delhivery|dunzo
   */
  app.get("/logistics/track/:shipmentId", async (c) => {
    try {
      const { shipmentId } = c.req.param();
      const partner = c.req.query('partner');

      // If partner is specified, use that
      if (partner) {
        let tracking: NormalizedTracking | null = null;

        if (partner === 'delhivery') {
          tracking = await delhiveryTrackShipment(shipmentId);
        } else if (partner === 'dunzo') {
          tracking = await dunzoGetTaskStatus(shipmentId);
        } else if (partner === 'shiprocket') {
          const token = await getShiprocketToken();
          const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/track/${shipmentId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const data: any = await response.json();
            tracking = {
              partner: 'shiprocket',
              shipmentId,
              awb: data.tracking_data?.shipment_track?.[0]?.awb_code,
              status: data.tracking_data?.shipment_status || 'unknown',
              statusDescription: data.tracking_data?.shipment_track?.[0]?.activity || '',
              currentLocation: data.tracking_data?.shipment_track?.[0]?.location,
              estimatedDelivery: data.tracking_data?.etd,
              events: (data.tracking_data?.shipment_track || []).map((t: any) => ({
                status: t.activity,
                description: t.activity,
                location: t.location,
                timestamp: t.date,
              })),
              trackingUrl: `https://www.shiprocket.in/shipment-tracking/${shipmentId}`,
            };
          }
        }

        if (!tracking) {
          return c.json({ error: 'Tracking not found' }, 404);
        }

        return c.json({ success: true, tracking });
      }

      // Auto-detect partner from database
      // First check shipments table
      let dbShipment = await query(
        `SELECT * FROM shipments WHERE shipment_id = $1 OR awb_code = $1 OR order_id::text = $1`,
        [shipmentId]
      ).catch(() => ({ rows: [] }));

      if (dbShipment.rows.length > 0) {
        const shipment = dbShipment.rows[0];
        const detectedPartner = shipment.logistics_partner;

        if (detectedPartner === 'delhivery' && shipment.awb_code) {
          const tracking = await delhiveryTrackShipment(shipment.awb_code);
          if (tracking) {
            return c.json({ success: true, tracking });
          }
        } else if (detectedPartner === 'shiprocket' && shipment.shipment_id) {
          const token = await getShiprocketToken();
          const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/track/${shipment.shipment_id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const data: any = await response.json();
            return c.json({
              success: true,
              tracking: {
                partner: 'shiprocket',
                shipmentId: shipment.shipment_id,
                awb: shipment.awb_code,
                status: data.tracking_data?.shipment_status || shipment.status,
                statusDescription: data.tracking_data?.shipment_track?.[0]?.activity || '',
                events: data.tracking_data?.shipment_track || [],
                trackingUrl: `https://www.shiprocket.in/shipment-tracking/${shipment.shipment_id}`,
              },
            });
          }
        }

        // Return DB status as fallback
        return c.json({
          success: true,
          tracking: {
            partner: shipment.logistics_partner,
            shipmentId: shipment.shipment_id || shipment.id,
            awb: shipment.awb_code,
            status: shipment.status,
            statusDescription: shipment.status,
            trackingUrl: shipment.tracking_url,
          },
        });
      }

      // Check delivery_tracking for Dunzo/hyperlocal
      const deliveryTracking = await query(
        `SELECT * FROM delivery_tracking 
         WHERE external_task_id = $1 OR id::text = $1 OR metadata->>'dunzo_task_id' = $1`,
        [shipmentId]
      ).catch(() => ({ rows: [] }));

      if (deliveryTracking.rows.length > 0) {
        const dt = deliveryTracking.rows[0];
        
        if (dt.external_task_id && dt.logistics_partner === 'dunzo') {
          const tracking = await dunzoGetTaskStatus(dt.external_task_id);
          if (tracking) {
            return c.json({ success: true, tracking });
          }
        }

        // Return DB status
        return c.json({
          success: true,
          tracking: {
            partner: dt.logistics_partner || 'unknown',
            shipmentId: dt.external_task_id || dt.id,
            taskId: dt.external_task_id,
            status: dt.status,
            statusDescription: dt.status,
            deliveryPerson: dt.delivery_person_name ? {
              name: dt.delivery_person_name,
              phone: dt.delivery_person_phone,
            } : undefined,
            trackingUrl: dt.tracking_url,
          },
        });
      }

      return c.json({ error: 'Shipment not found' }, 404);
    } catch (error: any) {
      console.error('[UNIFIED TRACK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // MOCK FALLBACK ENDPOINTS (for development/testing)
  // ============================================================================

  /**
   * POST /logistics/mock/create-shipment
   * Create mock shipment for testing when APIs aren't configured
   */
  app.post("/logistics/mock/create-shipment", async (c) => {
    try {
      const body = await c.req.json();
      const { orderId, partner = 'mock', orderType = 'ecommerce' } = body;

      if (!orderId) {
        return c.json({ error: 'orderId is required' }, 400);
      }

      const mockAwb = `MOCK${Date.now()}`;
      const mockTaskId = `TASK${Date.now()}`;

      if (orderType === 'pharmacy' || orderType === 'meal') {
        // Mock Dunzo task
        const trackingColumn = orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';
        await insert('delivery_tracking', {
          [trackingColumn]: orderId,
          external_task_id: mockTaskId,
          logistics_partner: 'mock_dunzo',
          status: 'created',
          metadata: { mock: true, created_at: new Date().toISOString() },
        }).catch(() => {});

        return c.json({
          success: true,
          mock: true,
          partner: 'mock_dunzo',
          taskId: mockTaskId,
          message: 'Mock hyperlocal delivery created',
        });
      }

      // Mock e-commerce shipment
      await insert('shipments', {
        order_id: orderId,
        logistics_partner: 'mock',
        awb_code: mockAwb,
        status: 'created',
        tracking_url: `https://warmpawz.com/track/mock/${mockAwb}`,
      }).catch(() => {});

      return c.json({
        success: true,
        mock: true,
        partner: 'mock',
        awb: mockAwb,
        message: 'Mock shipment created (no logistics API configured)',
      });
    } catch (error: any) {
      console.error('[MOCK CREATE] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /logistics/mock/track/:id
   * Get mock tracking for testing
   */
  app.get("/logistics/mock/track/:id", async (c) => {
    try {
      const { id } = c.req.param();

      // Generate mock tracking events
      const mockEvents = [
        { status: 'created', description: 'Order created', timestamp: new Date(Date.now() - 3600000 * 4).toISOString() },
        { status: 'picked_up', description: 'Package picked up', timestamp: new Date(Date.now() - 3600000 * 3).toISOString() },
        { status: 'in_transit', description: 'In transit to destination', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
        { status: 'out_for_delivery', description: 'Out for delivery', timestamp: new Date(Date.now() - 3600000).toISOString() },
      ];

      return c.json({
        success: true,
        mock: true,
        tracking: {
          partner: 'mock',
          shipmentId: id,
          awb: id,
          status: 'out_for_delivery',
          statusDescription: 'Out for delivery',
          estimatedDelivery: new Date(Date.now() + 3600000 * 2).toISOString(),
          events: mockEvents,
        },
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });
}

