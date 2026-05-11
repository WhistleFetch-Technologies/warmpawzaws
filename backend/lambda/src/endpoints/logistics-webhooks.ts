/**
 * ============================================================================
 * LOGISTICS WEBHOOKS ENDPOINTS
 * ============================================================================
 * 
 * Handles incoming webhooks from logistics partners:
 * - Shiprocket status updates
 * - Delhivery status updates
 * - Dunzo delivery updates
 * - Pidge store-channel status (ecommerce shipments + pharmacy/meal delivery_tracking)
 * 
 * Also handles auto-shipment creation and notifications
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { logisticsPartnerService } from '../lib/services/logistics-partner-service';
import {
  getPidgeCredentials,
  getPidgeOrderDefaults,
  buildPidgeOrderPayloadFromSimplified,
  pidgeCreateOrder,
  extractPidgeOrderIdMap,
} from '../lib/services/pidge-logistics';

// Status mappings for different partners
const SHIPROCKET_STATUS_MAP: Record<string, string> = {
  'AWB Assigned': 'awb_generated',
  'Pickup Scheduled': 'pickup_scheduled',
  'Picked Up': 'picked_up',
  'In Transit': 'in_transit',
  'Out For Delivery': 'out_for_delivery',
  'Delivered': 'delivered',
  'RTO Initiated': 'rto_initiated',
  'RTO In Transit': 'rto_in_transit',
  'RTO Delivered': 'returned',
  'Cancelled': 'cancelled',
  'Lost': 'lost',
  'Damaged': 'damaged',
};

const DELHIVERY_STATUS_MAP: Record<string, string> = {
  'Manifested': 'awb_generated',
  'In Transit': 'in_transit',
  'Dispatched': 'in_transit',
  'Pending': 'pending',
  'Out for Delivery': 'out_for_delivery',
  'Delivered': 'delivered',
  'RTO': 'rto_initiated',
  'Returned': 'returned',
  'Cancelled': 'cancelled',
};

/** Pidge fulfillment.status → internal shipment status (aligned with Shiprocket-style keys). */
const PIDGE_FULFILLMENT_STATUS_MAP: Record<string, string> = {
  CANCELLED: 'cancelled',
  CREATED: 'awb_generated',
  OUT_FOR_PICKUP: 'pickup_scheduled',
  REACHED_PICKUP: 'pickup_scheduled',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  REACHED_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  DISPOSED: 'delivered',
  UNDELIVERED: 'out_for_delivery',
  RTO_OUT_FOR_DELIVERY: 'rto_initiated',
  RTO_UNDELIVERED: 'rto_initiated',
  RTO_DELIVERED: 'returned',
  LOST: 'lost',
  DAMAGED: 'damaged',
};

/** Pidge parent order status (lowercase) when fulfillment block missing. */
const PIDGE_PARENT_STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  fulfilled: 'in_transit',
  completed: 'delivered',
  cancelled: 'cancelled',
};

/** shipments.status CHECK (legacy) allows only these values in many DBs. */
function coercePidgeStatusForShipmentsTable(status: string): string {
  const allowed = new Set([
    'created',
    'awb_generated',
    'picked_up',
    'in_transit',
    'delivered',
    'returned',
    'cancelled',
  ]);
  if (allowed.has(status)) return status;
  const map: Record<string, string> = {
    pending: 'created',
    pickup_scheduled: 'awb_generated',
    out_for_delivery: 'in_transit',
    unknown: 'in_transit',
    rto_initiated: 'returned',
    lost: 'cancelled',
    damaged: 'cancelled',
  };
  return map[status] || 'in_transit';
}

/** Map Pidge fulfillment-derived status to delivery_tracking.status (hyperlocal). */
function mapPidgeNormalizedToDeliveryTrackingStatus(normalized: string): string {
  switch (normalized) {
    case 'delivered':
      return 'delivered';
    case 'picked_up':
      return 'picked_up';
    case 'cancelled':
      return 'failed';
    case 'in_transit':
    case 'out_for_delivery':
    case 'unknown':
      return 'on_the_way';
    default:
      return 'heading_to_pickup';
  }
}

/** Map Pidge status to pharmacy_orders / meal_orders status when applicable. */
function mapPidgeNormalizedToPharmacyMealOrderStatus(normalized: string): string | null {
  switch (normalized) {
    case 'delivered':
      return 'delivered';
    case 'picked_up':
      return 'picked_up';
    case 'cancelled':
      return 'cancelled';
    case 'in_transit':
    case 'out_for_delivery':
    case 'unknown':
      return 'on_the_way';
    case 'awb_generated':
    case 'pickup_scheduled':
    case 'pending':
      return 'ready_for_pickup';
    default:
      return null;
  }
}

function buildHyperlocalLineItemsForPidge(orderType: string, order: any): Record<string, unknown>[] {
  if (orderType === 'pharmacy') {
    let raw = order.items;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw || '[]');
      } catch {
        raw = [];
      }
    }
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) {
      return [
        {
          name: 'Pharmacy order',
          sku: 'pharmacy',
          quantity: 1,
          price: Number(order.subtotal || order.total_amount || 0),
        },
      ];
    }
    return arr.map((it: Record<string, unknown>) => ({
      name: String(it.medicine_name || it.name || it.product_name || 'Item'),
      sku: String(it.sku || it.id || ''),
      quantity: Number(it.quantity ?? 1) || 1,
      price: Number(it.unit_price ?? it.price ?? it.total ?? 0),
    }));
  }

  const qty = Number(order.quantity || 1) || 1;
  return [
    {
      name: 'Meal order',
      sku: String(order.meal_plan_id || 'meal'),
      quantity: qty,
      price: Number(order.subtotal || order.total_amount || 0),
    },
  ];
}

export function registerLogisticsWebhookEndpoints(app: Hono) {
  
  // ============================================================================
  // SHIPROCKET WEBHOOK
  // ============================================================================
  
  /**
   * POST /webhooks/shiprocket
   * Receives status updates from Shiprocket
   */
  app.post("/webhooks/shiprocket", async (c) => {
    try {
      const payload = await c.req.json();
      console.log('[SHIPROCKET WEBHOOK] Received:', JSON.stringify(payload));

      // Shiprocket sends different event types
      const {
        awb,
        order_id,
        shipment_id,
        current_status,
        current_status_id,
        scans,
        etd,
        delivered_date,
        pickup_date,
      } = payload;

      if (!awb && !order_id && !shipment_id) {
        return c.json({ error: 'Missing identifier' }, 400);
      }

      // Find the shipment in our database
      let shipment: any = null;
      
      if (awb) {
        const result = await query(
          'SELECT * FROM shipments WHERE awb_code = $1',
          [awb]
        );
        if (result.rows.length > 0) shipment = result.rows[0];
      }
      
      if (!shipment && order_id) {
        const result = await query(
          'SELECT * FROM shipments WHERE order_id = $1::uuid OR order_id::text = $1',
          [order_id]
        );
        if (result.rows.length > 0) shipment = result.rows[0];
      }

      if (!shipment && shipment_id) {
        const result = await query(
          'SELECT * FROM shipments WHERE shipment_id = $1',
          [shipment_id.toString()]
        );
        if (result.rows.length > 0) shipment = result.rows[0];
      }

      if (!shipment) {
        console.warn('[SHIPROCKET WEBHOOK] Shipment not found for:', { awb, order_id, shipment_id });
        return c.json({ success: true, message: 'Shipment not found, ignored' });
      }

      // Map status
      const normalizedStatus = SHIPROCKET_STATUS_MAP[current_status] || 'unknown';
      const previousStatus = shipment.status;

      // Update shipment
      await update('shipments', { id: shipment.id }, {
        status: normalizedStatus,
        current_location: scans?.[0]?.location || null,
        estimated_delivery: etd || null,
        delivered_at: delivered_date ? new Date(delivered_date).toISOString() : null,
        picked_up_at: pickup_date ? new Date(pickup_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      });

      // Add tracking event
      try {
        await insert('shipment_tracking_events', {
          shipment_id: shipment.id,
          event_type: current_status,
          event_description: scans?.[0]?.activity || current_status,
          location: scans?.[0]?.location || null,
          event_time: scans?.[0]?.date ? new Date(scans[0].date).toISOString() : new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[SHIPROCKET WEBHOOK] Failed to insert tracking event:', err instanceof Error ? err.message : err);
      }

      // Update order status
      if (shipment.order_id) {
        await updateOrderStatus(shipment.order_id, normalizedStatus).catch((e) => {
          console.error('[SHIPROCKET WEBHOOK] Error updating order:', e);
        });
      }

      // Send notification to customer
      await sendShipmentNotification(shipment.order_id, normalizedStatus, previousStatus, {
        awb,
        location: scans?.[0]?.location,
        etd,
      }).catch((e) => {
        console.error('[SHIPROCKET WEBHOOK] Error sending notification:', e);
      });

      return c.json({ 
        success: true, 
        message: 'Status updated',
        shipmentId: shipment.id,
        status: normalizedStatus,
      });
    } catch (error: any) {
      console.error('[SHIPROCKET WEBHOOK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // DELHIVERY WEBHOOK
  // ============================================================================
  
  /**
   * POST /webhooks/delhivery
   * Receives status updates from Delhivery
   */
  app.post("/webhooks/delhivery", async (c) => {
    try {
      const payload = await c.req.json();
      console.log('[DELHIVERY WEBHOOK] Received:', JSON.stringify(payload));

      const {
        Waybill,
        OrderID,
        Status,
        StatusDateTime,
        Location,
        ExpectedDeliveryDate,
        Scans,
      } = payload.ShipmentData?.[0] || payload;

      if (!Waybill && !OrderID) {
        return c.json({ error: 'Missing identifier' }, 400);
      }

      // Find shipment
      let shipment: any = null;
      
      if (Waybill) {
        const result = await query(
          'SELECT * FROM shipments WHERE awb_code = $1',
          [Waybill]
        );
        if (result.rows.length > 0) shipment = result.rows[0];
      }

      if (!shipment && OrderID) {
        const result = await query(
          'SELECT * FROM shipments WHERE order_id = $1::uuid OR order_id::text = $1',
          [OrderID]
        );
        if (result.rows.length > 0) shipment = result.rows[0];
      }

      if (!shipment) {
        console.warn('[DELHIVERY WEBHOOK] Shipment not found');
        return c.json({ success: true, message: 'Shipment not found, ignored' });
      }

      const normalizedStatus = DELHIVERY_STATUS_MAP[Status?.Status] || 'unknown';
      const previousStatus = shipment.status;

      // Update shipment
      await update('shipments', { id: shipment.id }, {
        status: normalizedStatus,
        current_location: Location || null,
        estimated_delivery: ExpectedDeliveryDate || null,
        updated_at: new Date().toISOString(),
      });

      // Add tracking event
      if (Scans && Scans.length > 0) {
        const latestScan = Scans[0];
        try {
          await insert('shipment_tracking_events', {
            shipment_id: shipment.id,
            event_type: latestScan.ScanType,
            event_description: latestScan.Instructions || Status?.Status,
            location: latestScan.ScannedLocation,
            event_time: new Date(latestScan.ScanDateTime).toISOString(),
          });
        } catch (err) {
          console.warn('[DELHIVERY WEBHOOK] Failed to insert tracking event:', err instanceof Error ? err.message : err);
        }
      }

      // Update order and notify
      if (shipment.order_id) {
        try {
          await updateOrderStatus(shipment.order_id, normalizedStatus);
        } catch (err) {
          console.warn('[DELHIVERY WEBHOOK] Failed to update order status:', err instanceof Error ? err.message : err);
        }
        try {
          await sendShipmentNotification(shipment.order_id, normalizedStatus, previousStatus, {
            awb: Waybill,
            location: Location,
            etd: ExpectedDeliveryDate,
          });
        } catch (err) {
          console.warn('[DELHIVERY WEBHOOK] Failed to send notification:', err instanceof Error ? err.message : err);
        }
      }

      return c.json({ success: true, status: normalizedStatus });
    } catch (error: any) {
      console.error('[DELHIVERY WEBHOOK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // DUNZO WEBHOOK (for pharmacy/meal delivery)
  // ============================================================================
  
  /**
   * POST /webhooks/dunzo
   * Receives updates from Dunzo for hyperlocal delivery
   */
  app.post("/webhooks/dunzo", async (c) => {
    try {
      const payload = await c.req.json();
      console.log('[DUNZO WEBHOOK] Received:', JSON.stringify(payload));

      const {
        task_id,
        state,
        runner,
        eta,
        tracking_url,
      } = payload;

      if (!task_id) {
        return c.json({ error: 'Missing task_id' }, 400);
      }

      // Find delivery tracking by task_id (stored in metadata or external_id)
      const result = await query(
        `SELECT * FROM delivery_tracking 
         WHERE external_task_id = $1 OR metadata->>'dunzo_task_id' = $1`,
        [task_id]
      );

      if (result.rows.length === 0) {
        console.warn('[DUNZO WEBHOOK] Tracking not found for task:', task_id);
        return c.json({ success: true, message: 'Tracking not found, ignored' });
      }

      const tracking = result.rows[0];
      
      // Map Dunzo states
      const stateMap: Record<string, string> = {
        'runner_assigned': 'assigned',
        'reached_for_pickup': 'at_pickup',
        'pickup_complete': 'picked_up',
        'started_for_delivery': 'on_the_way',
        'reached_for_delivery': 'nearby',
        'delivered': 'delivered',
        'cancelled': 'failed',
      };

      const normalizedStatus = stateMap[state] || tracking.status;

      // Update tracking
      await update('delivery_tracking', { id: tracking.id }, {
        status: normalizedStatus,
        delivery_person_name: runner?.name || tracking.delivery_person_name,
        delivery_person_phone: runner?.phone_number || tracking.delivery_person_phone,
        tracking_url: tracking_url,
        eta_to_delivery_minutes: eta?.minutes,
        updated_at: new Date().toISOString(),
      });

      // Update order
      const orderTable = tracking.pharmacy_order_id ? 'pharmacy_orders' : 'meal_orders';
      const orderId = tracking.pharmacy_order_id || tracking.meal_order_id;
      
      if (orderId) {
        await update(orderTable, { id: orderId }, {
          status: normalizedStatus,
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({ success: true, status: normalizedStatus });
    } catch (error: any) {
      console.error('[DUNZO WEBHOOK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // PIDGE WEBHOOK (store channel — status / fulfillment updates)
  // ============================================================================

  /**
   * GET /webhooks/pidge
   * Dummy/reference URL helper: shows the path to register in Pidge as "client" webhook URL.
   * Pidge will POST JSON to POST /webhooks/pidge (same keys as GET order API, not wrapped in data).
   */
  app.get('/webhooks/pidge', (c) => {
    const base = (
      process.env.PUBLIC_API_BASE_URL ||
      process.env.API_BASE_URL ||
      'https://YOUR_API_GATEWAY_OR_DOMAIN'
    ).replace(/\/$/, '');
    const clientUrl = `${base}/webhooks/pidge`;
    return c.json({
      ok: true,
      message:
        'Register clientUrl in Pidge (Channel integration → Webhook URL). For local dev use ngrok/cloudflared so Pidge can reach this host.',
      clientUrl,
      method: 'POST',
      note: 'Optional: set PIDGE_WEBHOOK_BEARER_TOKEN on the server, then send Authorization: Bearer <same token> on webhook requests.',
    });
  });

  /**
   * POST /webhooks/pidge
   * Ingest Pidge webhook payloads (Bearer optional if PIDGE_WEBHOOK_BEARER_TOKEN is unset).
   */
  app.post('/webhooks/pidge', async (c) => {
    try {
      const bearerSecret = process.env.PIDGE_WEBHOOK_BEARER_TOKEN;
      if (bearerSecret) {
        const auth = c.req.header('Authorization') || '';
        const expected = `Bearer ${bearerSecret}`;
        if (auth !== expected) {
          return c.json({ error: 'Unauthorized' }, 401);
        }
      }

      const payload = (await c.req.json()) as Record<string, unknown>;
      console.log('[PIDGE WEBHOOK] Received:', JSON.stringify(payload).slice(0, 4000));

      const pidgeId =
        payload.id !== undefined && payload.id !== null ? String(payload.id) : '';
      const referenceId =
        payload.reference_id !== undefined && payload.reference_id !== null
          ? String(payload.reference_id)
          : '';

      if (!pidgeId) {
        return c.json({ error: 'Missing id' }, 400);
      }

      const fulfillment = (payload.fulfillment || {}) as Record<string, unknown>;
      const ffStatus =
        typeof fulfillment.status === 'string' ? fulfillment.status.toUpperCase() : '';
      const parentStatus = String(payload.status || '').toLowerCase();

      let normalizedStatus =
        (ffStatus && PIDGE_FULFILLMENT_STATUS_MAP[ffStatus]) ||
        PIDGE_PARENT_STATUS_MAP[parentStatus] ||
        'unknown';

      const logs = Array.isArray(fulfillment.logs) ? fulfillment.logs : [];
      const lastLog = logs.length > 0 ? (logs[logs.length - 1] as Record<string, unknown>) : null;
      const rider = (fulfillment.rider || lastLog?.rider) as Record<string, unknown> | undefined;
      const lastLocation = lastLog?.location as Record<string, unknown> | undefined;

      const trackCode =
        typeof fulfillment.track_code === 'string' ? fulfillment.track_code : null;

      let shipment: any = null;

      const byShipment = await query(
        `SELECT * FROM shipments 
         WHERE logistics_partner = 'pidge' 
           AND (shipment_id = $1 OR shipment_id::text = $1)
         LIMIT 1`,
        [pidgeId]
      );
      if (byShipment.rows.length > 0) {
        shipment = byShipment.rows[0];
      }

      if (!shipment && referenceId) {
        const byRef = await query(
          `SELECT s.* FROM shipments s
           INNER JOIN orders o ON o.id = s.order_id
           WHERE s.logistics_partner = 'pidge'
             AND (o.order_number = $1 OR o.id::text = $1 OR s.awb_code = $1)
           LIMIT 1`,
          [referenceId]
        );
        if (byRef.rows.length > 0) shipment = byRef.rows[0];
      }

      if (!shipment) {
        const dtResult = await query(
          `SELECT * FROM delivery_tracking
           WHERE logistics_partner = 'pidge'
             AND (external_task_id = $1 OR external_task_id::text = $1)
           ORDER BY created_at DESC
           LIMIT 1`,
          [pidgeId]
        );
        if (dtResult.rows.length > 0) {
          const tracking = dtResult.rows[0];
          const dtStatus = mapPidgeNormalizedToDeliveryTrackingStatus(normalizedStatus);
          const riderName =
            rider && typeof rider.name === 'string' ? rider.name : undefined;
          const riderPhone =
            rider && (rider.mobile != null || rider.phone != null)
              ? String(rider.mobile ?? rider.phone)
              : undefined;

          await update('delivery_tracking', { id: tracking.id }, {
            status: dtStatus,
            tracking_url: trackCode || tracking.tracking_url,
            delivery_person_name: riderName || tracking.delivery_person_name,
            delivery_person_phone: riderPhone || tracking.delivery_person_phone,
            current_lat:
              lastLocation && typeof lastLocation.latitude === 'number'
                ? lastLocation.latitude
                : tracking.current_lat,
            current_lng:
              lastLocation && typeof lastLocation.longitude === 'number'
                ? lastLocation.longitude
                : tracking.current_lng,
            picked_up_at:
              normalizedStatus === 'picked_up'
                ? new Date().toISOString()
                : tracking.picked_up_at,
            delivered_at:
              normalizedStatus === 'delivered'
                ? new Date().toISOString()
                : tracking.delivered_at,
            updated_at: new Date().toISOString(),
          });

          const orderTable = tracking.pharmacy_order_id ? 'pharmacy_orders' : 'meal_orders';
          const hyperlocalOrderId = tracking.pharmacy_order_id || tracking.meal_order_id;
          const orderStatus = mapPidgeNormalizedToPharmacyMealOrderStatus(normalizedStatus);
          if (hyperlocalOrderId && orderStatus) {
            await update(orderTable, { id: hyperlocalOrderId }, {
              status: orderStatus,
              updated_at: new Date().toISOString(),
            });
          }

          return c.json({
            success: true,
            message: 'Pidge webhook processed (hyperlocal)',
            deliveryTrackingId: tracking.id,
            status: normalizedStatus,
          });
        }

        console.warn('[PIDGE WEBHOOK] Shipment not found for:', { pidgeId, referenceId });
        return c.json({ success: true, message: 'Shipment not found, ignored' });
      }

      const previousStatus = shipment.status;
      const shipmentRowStatus = coercePidgeStatusForShipmentsTable(normalizedStatus);

      await update('shipments', { id: shipment.id }, {
        status: shipmentRowStatus,
        awb_code: trackCode || shipment.awb_code,
        current_location:
          lastLocation &&
          typeof lastLocation.latitude === 'number' &&
          typeof lastLocation.longitude === 'number'
            ? `${lastLocation.latitude},${lastLocation.longitude}`
            : shipment.current_location,
        delivered_at:
          normalizedStatus === 'delivered' ? new Date().toISOString() : shipment.delivered_at,
        picked_up_at:
          normalizedStatus === 'picked_up' ? new Date().toISOString() : shipment.picked_up_at,
        updated_at: new Date().toISOString(),
      });

      try {
        const eventDesc =
          (lastLog?.remark as string) ||
          (lastLog?.status as string) ||
          ffStatus ||
          parentStatus ||
          'update';
        await insert('shipment_tracking_events', {
          shipment_id: shipment.id,
          event_type: (lastLog?.status as string) || ffStatus || parentStatus,
          event_description: eventDesc,
          location:
            lastLocation &&
            typeof lastLocation.latitude === 'number' &&
            typeof lastLocation.longitude === 'number'
              ? `${lastLocation.latitude},${lastLocation.longitude}`
              : null,
          event_time: lastLog?.timestamp
            ? new Date(String(lastLog.timestamp)).toISOString()
            : new Date().toISOString(),
        });
      } catch (err) {
        console.warn(
          '[PIDGE WEBHOOK] Failed to insert tracking event:',
          err instanceof Error ? err.message : err
        );
      }

      if (shipment.order_id) {
        await updateOrderStatus(shipment.order_id, normalizedStatus).catch((e) => {
          console.error('[PIDGE WEBHOOK] Error updating order:', e);
        });
      }

      await sendShipmentNotification(shipment.order_id, normalizedStatus, previousStatus, {
        awb: trackCode || undefined,
        location:
          rider && typeof rider.name === 'string'
            ? `${rider.name}${rider.mobile ? ` (${rider.mobile})` : ''}`
            : undefined,
      }).catch((e) => {
        console.error('[PIDGE WEBHOOK] Error sending notification:', e);
      });

      return c.json({
        success: true,
        message: 'Pidge webhook processed',
        shipmentId: shipment.id,
        status: normalizedStatus,
      });
    } catch (error: any) {
      console.error('[PIDGE WEBHOOK] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // AUTO-SHIPMENT CREATION (Called after payment success)
  // ============================================================================
  
  /**
   * POST /logistics/auto-create-shipment
   * Automatically creates shipment after order payment
   */
  app.post("/logistics/auto-create-shipment", async (c) => {
    try {
      const { orderId, orderType = 'ecommerce' } = await c.req.json();

      if (!orderId) {
        return c.json({ error: 'orderId is required' }, 400);
      }

      // Get order details based on type
      let order: any = null;
      let orderItems: any[] = [];
      let vendorId: string | null = null;

      if (orderType === 'ecommerce') {
        const orders = await select('orders', { id: orderId });
        if (orders.length === 0) {
          return c.json({ error: 'Order not found' }, 404);
        }
        order = orders[0];
        
        // Get order items
        const items = await select('order_items', { order_id: orderId });
        orderItems = items;
        vendorId = order.vendor_id;
        
      } else if (orderType === 'pharmacy') {
        const orders = await select('pharmacy_orders', { id: orderId });
        if (orders.length === 0) {
          return c.json({ error: 'Pharmacy order not found' }, 404);
        }
        order = orders[0];
        vendorId = order.pharmacy_id;
        
      } else if (orderType === 'meal') {
        const orders = await select('meal_orders', { id: orderId });
        if (orders.length === 0) {
          return c.json({ error: 'Meal order not found' }, 404);
        }
        order = orders[0];
        vendorId = order.vendor_id;
      }

      // Get customer details
      let customer: any = null;
      if (order.customer_id) {
        const customers = await select('customers', { id: order.customer_id });
        if (customers.length > 0) customer = customers[0];
      }

      // Parse shipping address
      const shippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address || order.delivery_address;

      // Determine logistics type
      const logisticsType = order.logistics_type || 'warmpawz'; // warmpawz, vendor, shiprocket, delhivery

      if (orderType === 'pharmacy' || orderType === 'meal') {
        // For pharmacy/meal - hyperlocal: Pidge when configured, else internal fleet
        return await createHyperlocalDelivery(c, {
          orderId,
          orderType,
          order,
          vendorId,
          customer,
          shippingAddress,
        });
      }

      // For e-commerce - use Shiprocket/Delhivery
      // Select best logistics partner based on rules
      const partner = await logisticsPartnerService.selectPartner({
        orderId,
        pickupLocation: {
          pincode: order.pickup_pincode || '560001', // Default vendor pincode
        },
        deliveryLocation: {
          pincode: shippingAddress?.pincode || shippingAddress?.zip,
          city: shippingAddress?.city,
          state: shippingAddress?.state,
        },
        weight: order.total_weight || 1,
        orderValue: parseFloat(order.total_amount || '0'),
        codAmount: order.payment_method === 'cod' ? parseFloat(order.total_amount || '0') : 0,
      });

      if (!partner) {
        // Fallback to Shiprocket if no partner selected
        console.warn('[AUTO-SHIPMENT] No partner selected, using Shiprocket as fallback');
      }

      const partnerType = partner?.partner_type || 'shiprocket';

      // Create shipment based on partner type
      if (partnerType === 'shiprocket') {
        return await createShiprocketShipment(c, {
          orderId,
          order,
          orderItems,
          customer,
          shippingAddress,
          partner,
        });
      } else if (partnerType === 'delhivery') {
        return await createDelhiveryShipment(c, {
          orderId,
          order,
          orderItems,
          customer,
          shippingAddress,
          partner,
        });
      }

      return c.json({ error: 'Unsupported logistics partner' }, 400);
    } catch (error: any) {
      console.error('[AUTO-SHIPMENT] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // SHIPPING RATE CALCULATOR (Real API)
  // ============================================================================
  
  /**
   * POST /logistics/calculate-rates
   * Calculate real shipping rates from multiple partners
   */
  app.post("/logistics/calculate-rates", async (c) => {
    try {
      const {
        pickupPincode,
        deliveryPincode,
        weight,
        length,
        breadth,
        height,
        codAmount,
        declaredValue,
      } = await c.req.json();

      if (!pickupPincode || !deliveryPincode) {
        return c.json({ error: 'pickupPincode and deliveryPincode are required' }, 400);
      }

      const rates: any[] = [];

      // Get Shiprocket rates
      try {
        const shiprocketRates = await getShiprocketRates({
          pickupPincode,
          deliveryPincode,
          weight: weight || 0.5,
          length: length || 10,
          breadth: breadth || 10,
          height: height || 10,
          codAmount: codAmount || 0,
          declaredValue: declaredValue || 500,
        });
        rates.push(...shiprocketRates);
      } catch (e) {
        console.error('Error getting Shiprocket rates:', e);
      }

      // Sort by price
      rates.sort((a, b) => a.totalCharge - b.totalCharge);

      // Calculate estimated delivery dates
      const today = new Date();
      rates.forEach((rate) => {
        rate.estimatedDelivery = new Date(
          today.getTime() + (rate.estimatedDays || 5) * 24 * 60 * 60 * 1000
        ).toISOString().split('T')[0];
      });

      return c.json({
        success: true,
        serviceable: rates.length > 0,
        rates,
        cheapest: rates[0] || null,
        fastest: rates.reduce((a, b) => (a.estimatedDays < b.estimatedDays ? a : b), rates[0]) || null,
      });
    } catch (error: any) {
      console.error('[RATE CALCULATOR] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // PINCODE SERVICEABILITY CHECK
  // ============================================================================
  
  /**
   * GET /logistics/serviceability/:pincode
   * Check if delivery is available to a pincode
   */
  app.get("/logistics/serviceability/:pincode", async (c) => {
    try {
      const { pincode } = c.req.param();
      const pickupPincode = c.req.query('pickup') || '560001';

      // Check Shiprocket serviceability
      const settings = await select('platform_settings', { setting_key: 'platform:integrations:shiprocket' });
      const config = settings.length > 0 ? (settings[0].setting_value as any) : null;

      if (!config?.email || !config?.password) {
        // Return optimistic response if Shiprocket not configured
        return c.json({
          success: true,
          serviceable: true,
          partners: ['local'],
          estimatedDays: 5,
        });
      }

      const token = await getShiprocketToken();
      
      const response = await fetch(
        `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${pincode}&weight=0.5&cod=0`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        return c.json({
          success: true,
          serviceable: true,
          partners: ['local'],
          note: 'Serviceability check failed, assuming serviceable',
        });
      }

      const data: any = await response.json();
      const couriers = data.data?.available_courier_companies || [];

      return c.json({
        success: true,
        serviceable: couriers.length > 0,
        partners: couriers.map((c: any) => c.courier_name),
        estimatedDays: couriers[0]?.estimated_delivery_days || 5,
        codAvailable: couriers.some((c: any) => c.cod === 1),
      });
    } catch (error: any) {
      console.error('[SERVICEABILITY] Error:', error);
      // Return optimistic response on error
      return c.json({
        success: true,
        serviceable: true,
        partners: ['local'],
        error: error.message,
      });
    }
  });

  // ============================================================================
  // VENDOR LOGISTICS ENDPOINTS
  // ============================================================================
  
  /**
   * GET /vendor/:vendorId/logistics/orders
   * Get orders pending shipment for vendor
   */
  app.get("/vendor/:vendorId/logistics/orders", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status') || 'pending';

      const result = await query(
        `SELECT o.*, 
                s.awb_code, s.status as shipment_status, s.courier_name,
                c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN shipments s ON o.id = s.order_id
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.vendor_id = $1 
         AND o.order_status = $2
         ORDER BY o.created_at DESC
         LIMIT 50`,
        [vendorId, status]
      );

      return c.json({
        success: true,
        orders: result.rows,
      });
    } catch (error: any) {
      console.error('[VENDOR LOGISTICS] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/logistics/ship/:orderId
   * Vendor initiates shipment for an order
   */
  app.post("/vendor/:vendorId/logistics/ship/:orderId", async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const { courier, trackingNumber, estimatedDays } = await c.req.json();

      // Verify vendor owns this order
      const orders = await query(
        'SELECT * FROM orders WHERE id = $1 AND vendor_id = $2',
        [orderId, vendorId]
      );

      if (orders.rows.length === 0) {
        return c.json({ error: 'Order not found or not owned by vendor' }, 404);
      }

      const order = orders.rows[0];

      if (trackingNumber) {
        // Vendor providing their own tracking
        await insert('shipments', {
          order_id: orderId,
          logistics_partner: 'vendor',
          courier_name: courier || 'Vendor Shipping',
          awb_code: trackingNumber,
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          estimated_delivery: estimatedDays 
            ? new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString()
            : null,
        });

        await update('orders', { id: orderId }, {
          order_status: 'shipped',
          shipped_at: new Date().toISOString(),
          tracking_number: trackingNumber,
          delivery_partner: courier,
        });

        return c.json({
          success: true,
          message: 'Shipment created with vendor tracking',
          awb: trackingNumber,
        });
      }

      // Use platform logistics (Shiprocket)
      const customer = order.customer_id 
        ? (await select('customers', { id: order.customer_id }))[0]
        : null;

      const shippingAddress = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;

      const orderItems = await select('order_items', { order_id: orderId });

      const result = await createShiprocketShipmentInternal({
        orderId,
        order,
        orderItems,
        customer,
        shippingAddress,
      });

      return c.json(result);
    } catch (error: any) {
      console.error('[VENDOR SHIP] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // CUSTOMER TRACKING ENDPOINT
  // ============================================================================

  function normalizeTrackingPhoneDigits(p: string | undefined | null): string {
    if (!p) return '';
    let d = String(p).replace(/\D/g, '');
    if (d.length > 10 && d.startsWith('91')) d = d.slice(-10);
    else if (d.length > 10) d = d.slice(-10);
    return d;
  }

  async function assertCustomerOwnsOrderForTracking(order: any, queryPhone: string | undefined): Promise<boolean> {
    if (!queryPhone?.trim()) return true;
    const want = normalizeTrackingPhoneDigits(queryPhone);
    if (!want) return true;
    const candidates = [order.customer_phone, order.shipping_phone, order.phone, order.customerPhone].map((x) =>
      normalizeTrackingPhoneDigits(x),
    );
    if (candidates.some((c) => c && c === want)) return true;
    const cid = order.customer_id;
    if (cid) {
      const r = await query(`SELECT phone FROM customers WHERE id = $1 LIMIT 1`, [cid]).catch(() => ({ rows: [] }));
      const ph = normalizeTrackingPhoneDigits(r.rows[0]?.phone);
      if (ph && ph === want) return true;
    }
    return false;
  }
  
  /**
   * GET /customer/tracking/:orderId
   * Customer views their order tracking
   */
  app.get("/customer/tracking/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();
      const phone = c.req.query('phone');

      // Find order (check multiple tables)
      let order: any = null;
      let orderType = 'ecommerce';
      
      // Check e-commerce orders
      // Use COALESCE to handle both UUID and order_number lookups safely
      let result = await query(
        `SELECT * FROM orders 
         WHERE (id::text = $1 OR order_number = $1)`,
        [orderId]
      ).catch(() => ({ rows: [] }));
      
      if (result.rows.length > 0) {
        order = result.rows[0];
        const ot = String(order.order_type || '').toLowerCase();
        if (ot === 'meal_plan_delivery' || ot === 'nutrition_delivery') {
          orderType = 'meal';
        }
      } else {
        // Check pharmacy orders
        result = await query(
          `SELECT * FROM pharmacy_orders 
           WHERE (id::text = $1 OR order_number = $1)`,
          [orderId]
        ).catch(() => ({ rows: [] }));
        if (result.rows.length > 0) {
          order = result.rows[0];
          orderType = 'pharmacy';
        } else {
          // Check meal orders (id only – meal_orders may not have order_number)
          result = await query(
            `SELECT * FROM meal_orders WHERE id::text = $1`,
            [orderId]
          ).catch(() => ({ rows: [] }));
          if (result.rows.length > 0) {
            order = result.rows[0];
            orderType = 'meal';
          }
        }
      }

      if (!order) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const authorized = await assertCustomerOwnsOrderForTracking(order, phone);
      if (!authorized) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Get tracking info based on order type
      if (orderType === 'ecommerce') {
        // Get shipment tracking
        const shipments = await query(
          `SELECT s.*, 
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'event', ste.event_type,
                        'description', ste.event_description,
                        'location', ste.location,
                        'time', ste.event_time
                      ) ORDER BY ste.event_time DESC
                    ) FILTER (WHERE ste.id IS NOT NULL),
                    '[]'
                  ) as events
           FROM shipments s
           LEFT JOIN shipment_tracking_events ste ON s.id = ste.shipment_id
           WHERE s.order_id = $1
           GROUP BY s.id
           ORDER BY s.created_at DESC
           LIMIT 1`,
          [order.id]
        );

        const shipment = shipments.rows[0];

        return c.json({
          success: true,
          orderType,
          order: {
            id: order.id,
            orderNumber: order.order_number,
            status: order.order_status,
            total: order.total_amount,
            createdAt: order.created_at,
          },
          tracking: shipment ? {
            awb: shipment.awb_code,
            courier: shipment.courier_name,
            status: shipment.status,
            currentLocation: shipment.current_location,
            estimatedDelivery: shipment.estimated_delivery,
            trackingUrl: shipment.tracking_url,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
            events: shipment.events,
          } : null,
        });
      } else {
        // Pharmacy/Meal - Get delivery tracking (meal: meal_orders.id OR subscription_delivery_id)
        const trackingSql =
          orderType === 'pharmacy'
            ? `SELECT dt.*,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'lat', dlh.lat,
                        'lng', dlh.lng,
                        'time', dlh.recorded_at
                      ) ORDER BY dlh.recorded_at DESC
                    ) FILTER (WHERE dlh.id IS NOT NULL),
                    '[]'
                  ) as location_history
           FROM delivery_tracking dt
           LEFT JOIN delivery_location_history dlh ON dt.id = dlh.tracking_id
           WHERE dt.pharmacy_order_id::text = $1
           GROUP BY dt.id
           ORDER BY dt.created_at DESC
           LIMIT 1`
            : `SELECT dt.*,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'lat', dlh.lat,
                        'lng', dlh.lng,
                        'time', dlh.recorded_at
                      ) ORDER BY dlh.recorded_at DESC
                    ) FILTER (WHERE dlh.id IS NOT NULL),
                    '[]'
                  ) as location_history
           FROM delivery_tracking dt
           LEFT JOIN delivery_location_history dlh ON dt.id = dlh.tracking_id
           WHERE dt.meal_order_id::text = $1 OR dt.subscription_delivery_id::text = $1
           GROUP BY dt.id
           ORDER BY dt.created_at DESC
           LIMIT 1`;

        const tracking = await query(trackingSql, [order.id]).catch(() => ({ rows: [] }));

        const deliveryTracking = tracking.rows[0];
        const displayStatus = order.status ?? order.order_status ?? 'pending';

        return c.json({
          success: true,
          orderType,
          order: {
            id: order.id,
            order_number: order.order_number || order.id?.toString().slice(-8),
            orderNumber: order.order_number || order.id?.toString().slice(-8),
            status: displayStatus,
            total: order.total_amount,
            total_amount: order.total_amount,
            createdAt: order.created_at,
            created_at: order.created_at,
          },
          tracking: deliveryTracking ? {
            // ✅ FIX: Map backend status to frontend-expected status
            // 'heading_to_pickup' means rider is assigned and heading to vendor → map to 'assigned' for "Rider Assigned"
            status: deliveryTracking.status === 'heading_to_pickup' ? 'assigned' : deliveryTracking.status,
            deliveryOtp: deliveryTracking.delivery_otp || null,
            deliveryPerson: {
              name: deliveryTracking.delivery_person_name,
              phone: deliveryTracking.delivery_person_phone,
              photo: deliveryTracking.delivery_person_photo,
              vehicleNumber: deliveryTracking.vehicle_number,
            },
            currentLocation: deliveryTracking.current_lat ? {
              lat: parseFloat(deliveryTracking.current_lat),
              lng: parseFloat(deliveryTracking.current_lng),
            } : null,
            eta: deliveryTracking.eta_to_delivery_minutes,
            distanceRemaining: deliveryTracking.distance_remaining_km,
            assignedAt: deliveryTracking.assigned_at,
            pickedUpAt: deliveryTracking.picked_up_at,
            deliveredAt: deliveryTracking.delivered_at,
            trackingUrl: deliveryTracking.tracking_url,
            locationHistory: deliveryTracking.location_history?.slice(0, 20) || [],
          } : {
            // ✅ FIX: When no delivery_tracking exists, show "Finding Rider" (pending_assignment)
            // This matches the frontend's deliveryStatusSteps which expects 'pending_assignment' for "Finding Rider"
            status: 'pending_assignment',
            deliveryOtp: null,
            deliveryPerson: null,
          },
        });
      }
    } catch (error: any) {
      console.error('[CUSTOMER TRACKING] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let shiprocketToken: string | null = null;
let tokenExpiry: number = 0;

async function getShiprocketToken(): Promise<string> {
  if (shiprocketToken && Date.now() < tokenExpiry) {
    return shiprocketToken;
  }

  const settings = await select('platform_settings', { setting_key: 'platform:integrations:shiprocket' });
  const config = settings.length > 0 ? (settings[0].setting_value as any) : null;

  if (!config?.email || !config?.password) {
    throw new Error('Shiprocket credentials not configured');
  }

  const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });

  if (!response.ok) {
    throw new Error('Shiprocket authentication failed');
  }

  const data: any = await response.json();
  shiprocketToken = data.token;
  tokenExpiry = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days

  return shiprocketToken!;
}

async function getShiprocketRates(params: {
  pickupPincode: string;
  deliveryPincode: string;
  weight: number;
  length: number;
  breadth: number;
  height: number;
  codAmount: number;
  declaredValue: number;
}): Promise<any[]> {
  const token = await getShiprocketToken();
  
  const response = await fetch(
    `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${params.pickupPincode}&delivery_postcode=${params.deliveryPincode}&weight=${params.weight}&length=${params.length}&breadth=${params.breadth}&height=${params.height}&cod=${params.codAmount > 0 ? 1 : 0}&declared_value=${params.declaredValue}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get Shiprocket rates');
  }

  const data: any = await response.json();
  const couriers = data.data?.available_courier_companies || [];

  return couriers.map((courier: any) => ({
    partner: 'shiprocket',
    courierId: courier.courier_company_id,
    courierName: courier.courier_name,
    totalCharge: courier.freight_charge + (courier.cod_charges || 0),
    freightCharge: courier.freight_charge,
    codCharges: courier.cod_charges || 0,
    estimatedDays: courier.estimated_delivery_days,
    rating: courier.rating,
    isCod: courier.cod === 1,
  }));
}

async function createShiprocketShipment(c: any, params: {
  orderId: string;
  order: any;
  orderItems: any[];
  customer: any;
  shippingAddress: any;
  partner: any;
}) {
  const result = await createShiprocketShipmentInternal(params);
  return c.json(result, result.success ? 200 : 500);
}

async function createShiprocketShipmentInternal(params: {
  orderId: string;
  order: any;
  orderItems: any[];
  customer: any;
  shippingAddress: any;
  partner?: any;
}) {
  const { orderId, order, orderItems, customer, shippingAddress } = params;

  try {
    const token = await getShiprocketToken();

    const shiprocketPayload = {
      order_id: orderId,
      order_date: new Date().toISOString().split('T')[0],
      pickup_location: 'Primary',
      billing_customer_name: shippingAddress?.name || customer?.name || 'Customer',
      billing_address: shippingAddress?.street || shippingAddress?.line1 || shippingAddress?.address || 'Address',
      billing_city: shippingAddress?.city || 'City',
      billing_pincode: shippingAddress?.pincode || shippingAddress?.zip || '000000',
      billing_state: shippingAddress?.state || 'State',
      billing_country: 'India',
      billing_email: customer?.email || 'customer@warmpawz.com',
      billing_phone: customer?.phone || shippingAddress?.phone || '0000000000',
      shipping_is_billing: true,
      order_items: orderItems.map((item: any) => ({
        name: item.product_name || item.name,
        sku: item.sku || item.product_id,
        units: item.quantity,
        selling_price: item.unit_price || item.price,
      })),
      payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
      sub_total: parseFloat(order.total_amount || '0'),
      length: 10,
      breadth: 10,
      height: 10,
      weight: order.total_weight || 0.5,
    };

    const response = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shiprocketPayload),
    });

    const result: any = await response.json();

    if (!response.ok || !result.order_id) {
      console.error('[SHIPROCKET] Create order failed:', result);
      throw new Error(result.message || 'Failed to create Shiprocket order');
    }

    // Store shipment
    await insert('shipments', {
      order_id: orderId,
      logistics_partner: 'shiprocket',
      logistics_partner_id: params.partner?.id || null,
      shipment_id: result.shipment_id?.toString(),
      awb_code: result.awb_code || null,
      courier_name: result.courier_name || null,
      status: result.awb_code ? 'awb_generated' : 'created',
      tracking_url: result.shipment_id 
        ? `https://www.shiprocket.in/shipment-tracking/${result.shipment_id}`
        : null,
    });

    // Update order
    await update('orders', { id: orderId }, {
      order_status: 'processing',
      tracking_number: result.awb_code,
      delivery_partner: result.courier_name || 'Shiprocket',
    });

    return {
      success: true,
      shiprocketOrderId: result.order_id,
      shipmentId: result.shipment_id,
      awb: result.awb_code,
      courier: result.courier_name,
    };
  } catch (error: any) {
    console.error('[SHIPROCKET CREATE] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function createDelhiveryShipment(c: any, params: {
  orderId: string;
  order: any;
  orderItems: any[];
  customer: any;
  shippingAddress: any;
  partner?: any;
}) {
  const { orderId, order, orderItems, customer, shippingAddress, partner } = params;

  try {
    // Import getSecretJson dynamically to avoid circular deps
    const { getSecretJson } = await import('../utils/aws/secrets-manager');
    
    // Get Delhivery credentials
    const config = await getSecretJson<{ api_token: string; client_name: string }>('delhivery');
    
    if (!config?.api_token || !config?.client_name) {
      console.warn('[DELHIVERY] Credentials not configured, falling back to Shiprocket');
      return c.json({
        success: false,
        error: 'Delhivery credentials not configured',
        fallbackToShiprocket: true,
      }, 501);
    }

    const delhiveryPayload = {
      shipments: [{
        name: shippingAddress?.name || customer?.name || 'Customer',
        add: shippingAddress?.street || shippingAddress?.line1 || shippingAddress?.address || 'Address',
        pin: shippingAddress?.pincode || shippingAddress?.zip || '000000',
        city: shippingAddress?.city || 'City',
        state: shippingAddress?.state || 'State',
        country: 'India',
        phone: customer?.phone || shippingAddress?.phone || '0000000000',
        order: orderId,
        payment_mode: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
        cod_amount: order.payment_method === 'cod' ? parseFloat(order.total_amount || '0') : 0,
        weight: (order.total_weight || 0.5) * 1000, // Convert kg to grams
        seller_name: config.client_name,
        products_desc: orderItems.map((i: any) => i.product_name || i.name).join(', ') || 'Order items',
        quantity: orderItems.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
        total_amount: parseFloat(order.total_amount || '0'),
      }],
    };

    const response = await fetch('https://track.delhivery.com/api/cmu/create.json', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${config.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(delhiveryPayload),
    });

    const result: any = await response.json();

    if (!response.ok || !result.success) {
      console.error('[DELHIVERY] Create order failed:', result);
      return c.json({
        success: false,
        error: result.rmk || 'Delhivery order creation failed',
      }, 500);
    }

    const waybill = result.packages?.[0]?.waybill;

    // Store shipment
    await insert('shipments', {
      order_id: orderId,
      logistics_partner: 'delhivery',
      logistics_partner_id: partner?.id || null,
      awb_code: waybill,
      status: 'created',
      tracking_url: `https://www.delhivery.com/track/package/${waybill}`,
    });

    // Update order
    await update('orders', { id: orderId }, {
      order_status: 'processing',
      tracking_number: waybill,
      delivery_partner: 'Delhivery',
    });

    return c.json({
      success: true,
      waybill,
      trackingUrl: `https://www.delhivery.com/track/package/${waybill}`,
    });
  } catch (error: any) {
    console.error('[DELHIVERY CREATE] Error:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
}

async function createHyperlocalDelivery(c: any, params: {
  orderId: string;
  orderType: string;
  order: any;
  vendorId: string | null;
  customer: any;
  shippingAddress: any;
}) {
  const { orderId, orderType, order, vendorId, customer, shippingAddress } = params;

  try {
    const orderTable = orderType === 'pharmacy' ? 'pharmacy_orders' : 'meal_orders';
    const orderIdField = orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';

    // Check if order already has tracking
    const existingTracking = await query(
      `SELECT * FROM delivery_tracking WHERE ${orderIdField} = $1`,
      [orderId]
    );

    if (existingTracking.rows.length > 0) {
      return c.json({
        success: true,
        message: 'Delivery already assigned',
        trackingId: existingTracking.rows[0].id,
      });
    }

    let pidgeConfigured = false;
    try {
      await getPidgeCredentials();
      pidgeConfigured = true;
    } catch {
      pidgeConfigured = false;
    }

    if (pidgeConfigured) {
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

      let pickupBlock: Record<string, unknown> = {
        name: 'WarmPawz Partner',
        mobile: '',
        email: '',
        address: {
          address_line_1: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India',
        },
      };

      if (vendorId) {
        const vendors = await select('vendors', { id: vendorId });
        const v = vendors[0];
        if (v) {
          pickupBlock = {
            name: String(v.business_name || v.owner_name || 'Store'),
            mobile: String(v.phone || ''),
            email: String(v.email || ''),
            address: {
              address_line_1: String(v.address || ''),
              city: String(v.city || ''),
              state: String(v.state || ''),
              pincode: String(v.pincode || ''),
              landmark: v.landmark ? String(v.landmark) : undefined,
              country: 'India',
              latitude: v.latitude != null ? Number(v.latitude) : undefined,
              longitude: v.longitude != null ? Number(v.longitude) : undefined,
            },
          };
        }
      }

      const addr = shippingAddress && typeof shippingAddress === 'object' ? shippingAddress : {};
      const receiverBlock: Record<string, unknown> = {
        name: String(
          customer?.full_name || (addr as any).name || order.customer_phone || 'Customer'
        ),
        mobile: String(
          customer?.phone || order.customer_phone || (addr as any).phone || ''
        ),
        email: String(customer?.email || (addr as any).email || ''),
        address: {
          address_line_1: String(
            (addr as any).address ||
              (addr as any).address_line_1 ||
              (addr as any).line1 ||
              ''
          ),
          city: String((addr as any).city || ''),
          state: String((addr as any).state || ''),
          pincode: String((addr as any).pincode || (addr as any).zip || ''),
          country: String((addr as any).country || 'India'),
          latitude:
            (addr as any).lat ??
            (addr as any).latitude ??
            order.delivery_lat ??
            order.customer_lat,
          longitude:
            (addr as any).lng ??
            (addr as any).longitude ??
            order.delivery_lng ??
            order.customer_lng,
        },
      };

      const totalAmount = parseFloat(String(order.total_amount ?? '0')) || 0;
      const codAmount =
        order.payment_method === 'cod' ? parseFloat(String(order.total_amount ?? '0')) || 0 : 0;
      const sourceOrderId = String(order.order_number || orderId).trim();

      const simplified: Record<string, unknown> = {
        orderId: sourceOrderId,
        sourceOrderId,
        referenceId: sourceOrderId,
        sender: pickupBlock,
        pickup: pickupBlock,
        receiver: receiverBlock,
        delivery: receiverBlock,
        items: buildHyperlocalLineItemsForPidge(orderType, order),
        billAmount: totalAmount,
        codAmount,
      };

      try {
        const defaults = await getPidgeOrderDefaults();
        const pidgePayload = buildPidgeOrderPayloadFromSimplified(simplified, defaults);
        const { json } = await pidgeCreateOrder(pidgePayload);
        const idMap = extractPidgeOrderIdMap(json);
        const firstSource = Object.keys(idMap)[0];
        const firstPidgeId = firstSource ? idMap[firstSource] : null;

        if (firstPidgeId) {
          const tracking = await insert('delivery_tracking', {
            [orderIdField]: orderId,
            logistics_partner_id: null,
            external_task_id: firstPidgeId,
            logistics_partner: 'pidge',
            status: 'assigned',
            delivery_otp: deliveryOtp,
            metadata: {
              usesPidge: true,
              pidge_order_id: firstPidgeId,
              reference_id: sourceOrderId,
            },
          });

          await update(orderTable, { id: orderId }, {
            status: 'ready_for_pickup',
            logistics_type: 'pidge',
          });

          return c.json({
            success: true,
            trackingId: tracking[0]?.id,
            deliveryOtp,
            pidgeOrderId: firstPidgeId,
            message: 'Pidge hyperlocal order created',
          });
        }

        console.warn('[HYPERLOCAL PIDGE] Create succeeded but no order id in response data:', json);
      } catch (pidgeErr: any) {
        console.error('[HYPERLOCAL PIDGE] Create failed, falling back to internal fleet:', pidgeErr);
      }
    }

    // Internal fleet or vendor delivery (Pidge not configured or create failed)
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const tracking = await insert('delivery_tracking', {
      [orderIdField]: orderId,
      logistics_partner_id: null,
      status: 'pending_assignment',
      delivery_otp: deliveryOtp,
    });

    await update(orderTable, { id: orderId }, {
      status: 'ready_for_pickup',
      logistics_type: 'warmpawz',
    });

    return c.json({
      success: true,
      trackingId: tracking[0]?.id,
      deliveryOtp,
      message: 'Ready for delivery assignment',
    });
  } catch (error: any) {
    console.error('[HYPERLOCAL DELIVERY] Error:', error);
    return c.json({ error: error.message }, 500);
  }
}

async function updateOrderStatus(orderId: string, status: string) {
  // Map shipment status to order status
  const orderStatusMap: Record<string, string> = {
    'awb_generated': 'processing',
    'pickup_scheduled': 'processing',
    'picked_up': 'shipped',
    'in_transit': 'shipped',
    'out_for_delivery': 'out_for_delivery',
    'delivered': 'delivered',
    'rto_initiated': 'return_initiated',
    'returned': 'returned',
    'cancelled': 'cancelled',
  };

  const orderStatus = orderStatusMap[status] || 'processing';

  await update('orders', { id: orderId }, {
    order_status: orderStatus,
    delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString(),
  });
}

async function sendShipmentNotification(
  orderId: string,
  status: string,
  previousStatus: string,
  details: { awb?: string; location?: string; etd?: string }
) {
  if (status === previousStatus) return;

  // Get order and customer
  const orders = await select('orders', { id: orderId });
  if (orders.length === 0) return;

  const order = orders[0];
  let customer: any = null;
  
  if (order.customer_id) {
    const customers = await select('customers', { id: order.customer_id });
    if (customers.length > 0) customer = customers[0];
  }

  if (!customer?.phone) return;

  // Notification messages
  const messages: Record<string, string> = {
    'picked_up': `Your order #${order.order_number} has been picked up and is on its way!`,
    'in_transit': `Your order #${order.order_number} is in transit${details.location ? ` - Currently at ${details.location}` : ''}.`,
    'out_for_delivery': `Your order #${order.order_number} is out for delivery! It will arrive soon.`,
    'delivered': `Your order #${order.order_number} has been delivered. Thank you for shopping with WarmPawz!`,
    'rto_initiated': `Your order #${order.order_number} is being returned to the seller.`,
  };

  const message = messages[status];
  if (!message) return;

  // Create notification
  await insert('notifications', {
    customer_id: order.customer_id,
    type: 'shipment_update',
    title: status === 'delivered' ? '📦 Order Delivered!' : '🚚 Shipment Update',
    message,
    data: {
      orderId,
      orderNumber: order.order_number,
      status,
      awb: details.awb,
      trackingUrl: `https://warmpawz.com/track/${orderId}`,
    },
    is_read: false,
  }).catch((e) => {
    console.error('Error creating notification:', e);
  });

  // TODO: Send SMS/WhatsApp notification
  // await sendSMSNotification(customer.phone, message);
}
