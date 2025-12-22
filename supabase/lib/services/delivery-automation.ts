/**
 * ============================================================================
 * DELIVERY AUTOMATION SERVICE
 * ============================================================================
 * 
 * Handles automatic shipment creation and delivery tracking
 * Integrates with logistics partners (Shiprocket, etc.)
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getPlatformSettingsRepository } from "../repositories/platform-settings.ts";
import { getAutomationJobsRepository } from "../repositories/automation-jobs.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface ShipmentData {
  order_id: string;
  pickup_pincode: string;
  delivery_pincode: string;
  weight_kg: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_pincode: string;
}

// ============================================================================
// SHIPMENT CREATION
// ============================================================================

/**
 * Create shipment automatically for order
 */
export async function createShipmentForOrder(orderId: string): Promise<string> {
  const client = getDbClient();
  
  // Get order
  const { data: order, error: orderError } = await client
    .from('orders')
    .select('*, customers(*), vendors(*)')
    .eq('id', orderId)
    .single();
  
  if (orderError || !order) {
    throw new Error(`Order not found: ${orderId}`);
  }
  
  // Check if shipment already exists
  const { data: existingShipment } = await client
    .from('shipments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  
  if (existingShipment) {
    return existingShipment.id;
  }
  
  // Get logistics partner
  const settingsRepo = getPlatformSettingsRepository();
  const logisticsPartners = await settingsRepo.getLogisticsPartners();
  const activePartner = logisticsPartners.find(p => p.enabled);
  
  if (!activePartner) {
    throw new Error('No active logistics partner configured');
  }
  
  // Prepare shipment data
  const customer = order.customers;
  const shipmentData: ShipmentData = {
    order_id: orderId,
    pickup_pincode: order.vendors?.pincode || '110001',
    delivery_pincode: order.shipping_pincode,
    weight_kg: 1.0, // Default weight, should be calculated from order items
    customer_name: customer?.full_name || 'Customer',
    customer_phone: order.shipping_phone,
    customer_address: order.shipping_address,
    customer_city: order.shipping_city,
    customer_state: order.shipping_state,
    customer_pincode: order.shipping_pincode,
  };
  
  // Create shipment based on partner
  let shipmentId: string;
  
  switch (activePartner.partner_type) {
    case 'shiprocket':
      shipmentId = await createShiprocketShipment(shipmentData, activePartner);
      break;
    default:
      throw new Error(`Unsupported logistics partner: ${activePartner.partner_type}`);
  }
  
  return shipmentId;
}

/**
 * Create shipment via Shiprocket
 */
async function createShiprocketShipment(
  data: ShipmentData,
  partner: any
): Promise<string> {
  try {
    // Get Shiprocket token
    const token = await getShiprocketToken(partner);
    if (!token) {
      throw new Error('Failed to authenticate with Shiprocket');
    }
    
    // Create shipment
    const response = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: data.order_id,
        order_date: new Date().toISOString(),
        pickup_location: 'Primary',
        billing_customer_name: data.customer_name,
        billing_last_name: '',
        billing_address: data.customer_address,
        billing_address_2: '',
        billing_city: data.customer_city,
        billing_pincode: data.customer_pincode,
        billing_state: data.customer_state,
        billing_country: 'India',
        billing_email: '',
        billing_phone: data.customer_phone,
        shipping_is_billing: true,
        order_items: [
          {
            name: 'Product',
            sku: 'SKU001',
            units: 1,
            selling_price: 0,
          },
        ],
        payment_method: 'Prepaid',
        sub_total: 0,
        length: 10,
        breadth: 10,
        height: 10,
        weight: data.weight_kg,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Shiprocket API error: ${JSON.stringify(errorData)}`);
    }
    
    const shipmentData = await response.json();
    
    // Save shipment to database
    const client = getDbClient();
    const { data: shipment, error } = await client
      .from('shipments')
      .insert({
        order_id: data.order_id,
        logistics_partner_id: partner.id,
        awb_code: shipmentData.awb_code || shipmentData.shipment_id,
        courier_name: shipmentData.courier_name || 'Shiprocket',
        pickup_pincode: data.pickup_pincode,
        delivery_pincode: data.delivery_pincode,
        weight_kg: data.weight_kg,
        shipment_status: 'picked_up',
        tracking_url: shipmentData.tracking_url || `https://shiprocket.co/tracking/${shipmentData.shipment_id}`,
        estimated_delivery_date: shipmentData.estimated_delivery_date ? new Date(shipmentData.estimated_delivery_date).toISOString().split('T')[0] : null,
      })
      .select()
      .single();
    
    if (error || !shipment) {
      throw new Error(`Failed to save shipment: ${error?.message || 'Unknown error'}`);
    }
    
    // Update order status
    await client
      .from('orders')
      .update({
        order_status: 'shipped',
        shipped_at: new Date().toISOString(),
      })
      .eq('id', data.order_id);
    
    // Create tracking event
    await client
      .from('shipment_tracking_events')
      .insert({
        shipment_id: shipment.id,
        event_type: 'shipment_created',
        event_description: 'Shipment created and picked up',
        location: data.customer_city,
        timestamp: new Date().toISOString(),
      });
    
    return shipment.id;
  } catch (error) {
    console.error('[DeliveryAutomation] Shiprocket shipment creation error:', error);
    throw error;
  }
}

/**
 * Get Shiprocket authentication token
 */
async function getShiprocketToken(partner: any): Promise<string | null> {
  try {
    if (!partner.email || !partner.password) {
      throw new Error('Shiprocket credentials not configured');
    }
    
    const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: partner.email,
        password: partner.password,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Shiprocket authentication failed');
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('[DeliveryAutomation] Shiprocket auth error:', error);
    return null;
  }
}

/**
 * Process webhook from logistics partner
 */
export async function processDeliveryWebhook(
  partnerType: string,
  webhookData: any
): Promise<void> {
  const client = getDbClient();
  
  switch (partnerType) {
    case 'shiprocket':
      await processShiprocketWebhook(webhookData);
      break;
    default:
      console.warn(`[DeliveryAutomation] Unsupported webhook type: ${partnerType}`);
  }
}

/**
 * Process Shiprocket webhook
 */
async function processShiprocketWebhook(webhookData: any): Promise<void> {
  const client = getDbClient();
  
  const awbCode = webhookData.awb_code || webhookData.shipment_id;
  const status = webhookData.status || webhookData.current_status;
  
  if (!awbCode) {
    console.error('[DeliveryAutomation] Missing AWB code in webhook');
    return;
  }
  
  // Find shipment
  const { data: shipment } = await client
    .from('shipments')
    .select('*, orders(*)')
    .eq('awb_code', awbCode)
    .single();
  
  if (!shipment) {
    console.error(`[DeliveryAutomation] Shipment not found for AWB: ${awbCode}`);
    return;
  }
  
  // Map Shiprocket status to our status
  const statusMap: Record<string, string> = {
    'NEW': 'pending',
    'PICKED_UP': 'picked_up',
    'IN_TRANSIT': 'in_transit',
    'OUT_FOR_DELIVERY': 'out_for_delivery',
    'DELIVERED': 'delivered',
    'RTO': 'returned',
    'CANCELLED': 'failed',
  };
  
  const mappedStatus = statusMap[status] || 'in_transit';
  
  // Update shipment status
  await client
    .from('shipments')
    .update({
      shipment_status: mappedStatus,
      updated_at: new Date().toISOString(),
      ...(mappedStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq('id', shipment.id);
  
  // Update order status if delivered
  if (mappedStatus === 'delivered' && shipment.order_id) {
    await client
      .from('orders')
      .update({
        order_status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', shipment.order_id);
  }
  
  // Create tracking event
  await client
    .from('shipment_tracking_events')
    .insert({
      shipment_id: shipment.id,
      event_type: mappedStatus,
      event_description: webhookData.status_message || `Status updated to ${mappedStatus}`,
      location: webhookData.current_location || '',
      timestamp: new Date(webhookData.timestamp || Date.now()).toISOString(),
      metadata: webhookData,
    });
}

/**
 * Auto-create shipments for orders ready to ship
 */
export async function autoCreateShipments(): Promise<void> {
  const client = getDbClient();
  
  // Get orders ready to ship (confirmed, not yet shipped)
  const { data: orders } = await client
    .from('orders')
    .select('*')
    .eq('order_status', 'confirmed')
    .is('shipped_at', null)
    .limit(100);
  
  if (!orders) return;
  
  for (const order of orders) {
    try {
      await createShipmentForOrder(order.id);
    } catch (error) {
      console.error(`[DeliveryAutomation] Error creating shipment for order ${order.id}:`, error);
    }
  }
}

