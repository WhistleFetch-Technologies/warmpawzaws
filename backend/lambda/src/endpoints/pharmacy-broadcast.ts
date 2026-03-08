/**
 * ============================================================================
 * PHARMACY BROADCAST ENDPOINTS - UBER-LIKE RADIUS EXPANSION
 * ============================================================================
 * 
 * Handles medicine order broadcasting to nearby pharmacies
 * - 5km → 10km → 20km radius expansion
 * - Real-time notifications to pharmacies
 * - Order acceptance flow
 * - Invoice generation
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { websocketService } from '../lib/services/websocket-service';
import { sendPharmacyBroadcast } from '../aws/aws-sns-notification-service';

// ============================================================================
// TYPES
// ============================================================================

interface PharmacyOrderRequest {
  customerId: string;
  customerPhone: string;
  prescriptionId?: string;
  prescriptionUrl?: string;
  medications?: Array<{
    name: string;
    quantity: number;
    dosage?: string;
  }>;
  deliveryAddress: {
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

interface PharmacyBroadcast {
  orderId: string;
  status: 'broadcasting' | 'accepted' | 'rejected' | 'expired';
  currentRadius: 5 | 10 | 20;
  notifiedPharmacies: string[];
  acceptedBy?: string;
  startedAt: Date;
  expiresAt: Date;
}

// Broadcast radius levels in kilometers
const RADIUS_LEVELS = [5, 10, 20] as const;
const RADIUS_EXPANSION_INTERVAL = 2 * 60 * 1000; // 2 minutes per radius level
const MAX_BROADCAST_DURATION = 6 * 60 * 1000; // 6 minutes total

// ============================================================================
// CREATE PHARMACY ORDER & START BROADCAST HANDLER
// ============================================================================

class CreatePharmacyOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event) as PharmacyOrderRequest;
    const { 
      customerId, 
      customerPhone, 
      prescriptionId, 
      prescriptionUrl,
      medications, 
      deliveryAddress, 
      notes 
    } = body;

    if (!customerId || !deliveryAddress) {
      return this.error('Customer ID and delivery address are required', 400);
    }

    if (!prescriptionId && !prescriptionUrl && (!medications || medications.length === 0)) {
      return this.error('Prescription or medications list is required', 400);
    }

    if (!deliveryAddress.latitude || !deliveryAddress.longitude) {
      return this.error('Delivery address coordinates are required', 400);
    }

    try {
      // Create the pharmacy order
      const orderData = {
        customer_id: customerId,
        customer_phone: customerPhone,
        prescription_id: prescriptionId || null,
        prescription_url: prescriptionUrl || null,
        medications: JSON.stringify(medications || []),
        delivery_address: JSON.stringify(deliveryAddress),
        delivery_latitude: deliveryAddress.latitude,
        delivery_longitude: deliveryAddress.longitude,
        status: 'pending',
        broadcast_status: 'broadcasting',
        current_radius: 5,
        current_broadcast_radius_km: 5, // For server-side expansion processor
        notes: notes || null,
        broadcast_started_at: new Date(),
        broadcast_expires_at: new Date(Date.now() + MAX_BROADCAST_DURATION),
        last_expanded_at: null, // Will be set when first expansion occurs
        expansion_count: 0, // Track number of expansions
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [order] = await insert('pharmacy_orders', orderData);

      // Create broadcast record with expansion tracking
      await insert('pharmacy_broadcasts', {
        order_id: order.id,
        current_radius: 5,
        status: 'broadcasting',
        started_at: new Date(),
        next_expansion_at: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL),
        last_expanded_at: null, // Will be set by server-side expansion processor
        expansion_count: 0,
      });

      // Start broadcasting to nearby pharmacies (first radius)
      const notifiedCount = await this.broadcastToPharmacies(order.id, deliveryAddress, 5);

      // Schedule radius expansions
      await this.scheduleRadiusExpansions(order.id);

      return this.success({
        success: true,
        orderId: order.id,
        broadcast: {
          status: 'broadcasting',
          currentRadius: 5,
          notifiedPharmacies: notifiedCount,
          expiresAt: orderData.broadcast_expires_at,
          nextExpansionAt: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL),
        },
        message: `Order broadcast started. ${notifiedCount} pharmacies within 5km notified.`,
      });
    } catch (error: any) {
      console.error('Error creating pharmacy order:', error);
      return this.error(error.message || 'Failed to create order', 500);
    }
  }

  private async broadcastToPharmacies(
    orderId: string, 
    location: { latitude: number; longitude: number },
    radiusKm: number
  ): Promise<number> {
    // Find pharmacies within radius using Haversine formula
    const { rows: pharmacies } = await query(
      `SELECT 
        v.id,
        v.business_name,
        v.phone,
        v.user_id,
        v.latitude,
        v.longitude,
        v.fcm_token,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(v.latitude)) *
            cos(radians(v.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(v.latitude))
          )
        ) AS distance_km
      FROM vendors v
      WHERE v.role_id IN (
        SELECT id FROM roles WHERE name IN ('pharmacy', 'pet_pharmacy', 'medical_store')
      )
      AND v.is_active = true
      AND v.is_verified = true
      AND v.latitude IS NOT NULL
      AND v.longitude IS NOT NULL
      AND (
        6371 * acos(
          cos(radians($1)) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(v.latitude))
        )
      ) <= $3
      ORDER BY distance_km ASC
      LIMIT 50`,
      [location.latitude, location.longitude, radiusKm]
    );

    if (pharmacies.length === 0) {
      return 0;
    }

    // Create notifications for each pharmacy
    for (const pharmacy of pharmacies) {
      // Check if already notified
      const { rows: existing } = await query(
        `SELECT id FROM pharmacy_order_notifications 
         WHERE order_id = $1 AND pharmacy_id = $2`,
        [orderId, pharmacy.id]
      );

      if (existing.length > 0) continue;

      // Create notification record
      await insert('pharmacy_order_notifications', {
        order_id: orderId,
        pharmacy_id: pharmacy.id,
        distance_km: pharmacy.distance_km,
        radius_level: radiusKm,
        status: 'pending',
        notified_at: new Date(),
      });

      // Create in-app notification
      await insert('notifications', {
        user_id: pharmacy.user_id || pharmacy.id,
        user_type: 'vendor',
        type: 'pharmacy_order',
        title: '🔔 New Medicine Order!',
        message: `New prescription order ${pharmacy.distance_km.toFixed(1)}km away. Tap to view and accept.`,
        data: JSON.stringify({
          order_id: orderId,
          type: 'pharmacy_order',
          distance: pharmacy.distance_km,
          priority: 'high',
        }),
        is_read: false,
        requires_action: true,
        action_url: `/orders/${orderId}`,
        expires_at: new Date(Date.now() + MAX_BROADCAST_DURATION),
        created_at: new Date(),
      });

      // Send push notification
      await sendPharmacyBroadcast(
        [pharmacy.id],
        orderId,
        'Customer',
        pharmacies.length
      );

      // Send WebSocket notification
      await websocketService.sendToUser(
        pharmacy.id,
        'vendor',
        {
          type: 'pharmacy_broadcast',
          data: {
            orderId,
            distance: pharmacy.distance_km,
            radius: radiusKm,
          },
          timestamp: new Date().toISOString(),
        }
      );
    }

    return pharmacies.length;
  }

  private async scheduleRadiusExpansions(orderId: string): Promise<void> {
    // Store scheduled expansions
    await insert('scheduled_tasks', {
      task_type: 'pharmacy_radius_expansion',
      reference_id: orderId,
      scheduled_at: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL),
      payload: JSON.stringify({ orderId, nextRadius: 10 }),
      status: 'pending',
    }).catch(() => {
      // Table might not exist - radius expansion will be handled by polling
    });
  }
}

// ============================================================================
// EXPAND BROADCAST RADIUS HANDLER
// ============================================================================

class ExpandBroadcastRadiusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;

    if (!orderId) {
      return this.error('Order ID is required', 400);
    }

    try {
      // Get current order and broadcast status
      const { rows: orders } = await query(
        `SELECT 
          po.id,
          po.delivery_latitude,
          po.delivery_longitude,
          po.broadcast_status,
          po.current_radius,
          po.current_broadcast_radius_km,
          po.broadcast_expires_at,
          po.expansion_count,
          po.last_expanded_at,
          pb.current_radius as broadcast_radius
        FROM pharmacy_orders po
        LEFT JOIN pharmacy_broadcasts pb ON pb.order_id = po.id
        WHERE po.id = $1`,
        [orderId]
      );

      if (orders.length === 0) {
        return this.error('Order not found', 404);
      }

      const order = orders[0];

      // Check if order is still in broadcasting state
      if (order.broadcast_status !== 'broadcasting') {
        return this.success({
          success: false,
          message: `Order is no longer broadcasting (status: ${order.broadcast_status})`,
        });
      }

      // Check if broadcast has expired
      if (new Date(order.broadcast_expires_at) < new Date()) {
        await update('pharmacy_orders', { id: orderId }, {
          broadcast_status: 'expired',
          status: 'expired',
          updated_at: new Date(),
        });

        return this.success({
          success: false,
          message: 'Broadcast has expired',
        });
      }

      // Determine next radius
      const currentRadius = order.current_radius || 5;
      const currentIndex = RADIUS_LEVELS.indexOf(currentRadius as 5 | 10 | 20);
      
      if (currentIndex === -1 || currentIndex >= RADIUS_LEVELS.length - 1) {
        return this.success({
          success: false,
          message: 'Maximum radius already reached',
          currentRadius,
        });
      }

      const nextRadius = RADIUS_LEVELS[currentIndex + 1];

      // Expand radius and notify new pharmacies
      const location = {
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
      };

      const notifiedCount = await this.broadcastToNewPharmacies(orderId, location, currentRadius, nextRadius);

      // Get current expansion count
      const currentExpansionCount = order.expansion_count || 0;

      // Update order and broadcast records with expansion tracking
      await update('pharmacy_orders', { id: orderId }, {
        current_radius: nextRadius,
        current_broadcast_radius_km: nextRadius,
        last_expanded_at: new Date(),
        expansion_count: currentExpansionCount + 1,
        updated_at: new Date(),
      });

      await update('pharmacy_broadcasts', { order_id: orderId }, {
        current_radius: nextRadius,
        next_expansion_at: nextRadius < 20 ? new Date(Date.now() + RADIUS_EXPANSION_INTERVAL) : null,
        last_expanded_at: new Date(),
        expansion_count: currentExpansionCount + 1,
      });

      return this.success({
        success: true,
        orderId,
        previousRadius: currentRadius,
        currentRadius: nextRadius,
        newPharmaciesNotified: notifiedCount,
        isMaxRadius: nextRadius === 20,
        message: `Radius expanded to ${nextRadius}km. ${notifiedCount} new pharmacies notified.`,
      });
    } catch (error: any) {
      console.error('Error expanding broadcast radius:', error);
      return this.error(error.message || 'Failed to expand radius', 500);
    }
  }

  private async broadcastToNewPharmacies(
    orderId: string,
    location: { latitude: number; longitude: number },
    previousRadius: number,
    newRadius: number
  ): Promise<number> {
    // Find pharmacies in the new radius band (between previous and new radius)
    const { rows: pharmacies } = await query(
      `SELECT 
        v.id,
        v.business_name,
        v.phone,
        v.user_id,
        v.latitude,
        v.longitude,
        v.fcm_token,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(v.latitude)) *
            cos(radians(v.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(v.latitude))
          )
        ) AS distance_km
      FROM vendors v
      WHERE v.role_id IN (
        SELECT id FROM roles WHERE name IN ('pharmacy', 'pet_pharmacy', 'medical_store')
      )
      AND v.is_active = true
      AND v.is_verified = true
      AND v.latitude IS NOT NULL
      AND v.longitude IS NOT NULL
      AND (
        6371 * acos(
          cos(radians($1)) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(v.latitude))
        )
      ) > $3
      AND (
        6371 * acos(
          cos(radians($1)) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(v.latitude))
        )
      ) <= $4
      ORDER BY distance_km ASC
      LIMIT 50`,
      [location.latitude, location.longitude, previousRadius, newRadius]
    );

    if (pharmacies.length === 0) {
      return 0;
    }

    // Create notifications for new pharmacies
    for (const pharmacy of pharmacies) {
      await insert('pharmacy_order_notifications', {
        order_id: orderId,
        pharmacy_id: pharmacy.id,
        distance_km: pharmacy.distance_km,
        radius_level: newRadius,
        status: 'pending',
        notified_at: new Date(),
      });

      await insert('notifications', {
        user_id: pharmacy.user_id || pharmacy.id,
        user_type: 'vendor',
        type: 'pharmacy_order',
        title: '🔔 Medicine Order Available!',
        message: `Prescription order ${pharmacy.distance_km.toFixed(1)}km away. Tap to view.`,
        data: JSON.stringify({
          order_id: orderId,
          type: 'pharmacy_order',
          distance: pharmacy.distance_km,
          priority: 'high',
        }),
        is_read: false,
        requires_action: true,
        action_url: `/orders/${orderId}`,
        created_at: new Date(),
      });
    }

    return pharmacies.length;
  }
}

// ============================================================================
// PHARMACY ACCEPT ORDER HANDLER
// ============================================================================

class PharmacyAcceptOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;
    const body = this.parseBody(context.event);
    const { pharmacyId, vendorId, estimatedTime, availableMedications, unavailableMedications } = body;

    const acceptingPharmacyId = pharmacyId || vendorId;

    if (!orderId || !acceptingPharmacyId) {
      return this.error('Order ID and Pharmacy ID are required', 400);
    }

    try {
      // Get order details
      const { rows: orders } = await query(
        `SELECT * FROM pharmacy_orders WHERE id = $1`,
        [orderId]
      );

      if (orders.length === 0) {
        return this.error('Order not found', 404);
      }

      const order = orders[0];

      // Check if order is still available
      if (order.status !== 'pending' || order.broadcast_status !== 'broadcasting') {
        return this.error('This order is no longer available', 400);
      }

      // Update order with accepting pharmacy
      await update('pharmacy_orders', { id: orderId }, {
        pharmacy_id: acceptingPharmacyId,
        status: 'accepted',
        broadcast_status: 'accepted',
        accepted_at: new Date(),
        estimated_preparation_time: estimatedTime || 30,
        available_medications: JSON.stringify(availableMedications || []),
        unavailable_medications: JSON.stringify(unavailableMedications || []),
        updated_at: new Date(),
      });

      // Update notification status
      await update('pharmacy_order_notifications', 
        { order_id: orderId, pharmacy_id: acceptingPharmacyId },
        { status: 'accepted' }
      );

      // Mark other notifications as missed
      await query(
        `UPDATE pharmacy_order_notifications 
         SET status = 'missed' 
         WHERE order_id = $1 AND pharmacy_id != $2`,
        [orderId, acceptingPharmacyId]
      );

      // Get pharmacy details
      const { rows: pharmacies } = await query(
        `SELECT business_name, phone, address, latitude, longitude 
         FROM vendors WHERE id = $1`,
        [acceptingPharmacyId]
      );

      const pharmacy = pharmacies.length > 0 ? pharmacies[0] : null;

      // Notify customer
      await insert('notifications', {
        user_id: order.customer_id,
        user_type: 'customer',
        type: 'order_accepted',
        title: '✅ Order Accepted!',
        message: `${pharmacy?.business_name || 'A pharmacy'} has accepted your order. They will prepare the invoice shortly.`,
        data: JSON.stringify({
          order_id: orderId,
          pharmacy_id: acceptingPharmacyId,
          pharmacy_name: pharmacy?.business_name,
        }),
        is_read: false,
        created_at: new Date(),
      });

      return this.success({
        success: true,
        orderId,
        order: {
          status: 'accepted',
          pharmacyId: acceptingPharmacyId,
          pharmacyName: pharmacy?.business_name,
          pharmacyPhone: pharmacy?.phone,
          acceptedAt: new Date(),
          estimatedPreparationTime: estimatedTime || 30,
        },
        message: 'Order accepted successfully!',
      });
    } catch (error: any) {
      console.error('Error accepting pharmacy order:', error);
      return this.error(error.message || 'Failed to accept order', 500);
    }
  }
}

// ============================================================================
// PHARMACY SUBMIT INVOICE HANDLER
// ============================================================================

class PharmacySubmitInvoiceHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;
    const body = this.parseBody(context.event);
    const { 
      pharmacyId,
      items,
      subtotal,
      discount,
      taxAmount,
      deliveryCharges,
      platformFee,
      convenienceFee,
      totalAmount,
      notes 
    } = body;

    if (!orderId || !pharmacyId || !items || !totalAmount) {
      return this.error('Missing required invoice fields', 400);
    }

    try {
      // Verify pharmacy owns this order
      const { rows: orders } = await query(
        `SELECT * FROM pharmacy_orders WHERE id = $1 AND pharmacy_id = $2`,
        [orderId, pharmacyId]
      );

      if (orders.length === 0) {
        return this.error('Order not found or unauthorized', 404);
      }

      const order = orders[0];

      if (order.status !== 'accepted') {
        return this.error('Order must be accepted before submitting invoice', 400);
      }

      // Create invoice
      const [invoice] = await insert('pharmacy_invoices', {
        order_id: orderId,
        pharmacy_id: pharmacyId,
        customer_id: order.customer_id,
        items: JSON.stringify(items),
        subtotal: subtotal || 0,
        discount: discount || 0,
        tax_amount: taxAmount || 0,
        delivery_charges: deliveryCharges || 0,
        platform_fee: platformFee || 0,
        convenience_fee: convenienceFee || 0,
        total_amount: totalAmount,
        status: 'pending_approval',
        notes: notes || null,
        created_at: new Date(),
      });

      // Update order status
      await update('pharmacy_orders', { id: orderId }, {
        status: 'invoice_sent',
        invoice_id: invoice.id,
        invoice_amount: totalAmount,
        updated_at: new Date(),
      });

      // Notify customer to approve invoice
      await insert('notifications', {
        user_id: order.customer_id,
        user_type: 'customer',
        type: 'invoice_ready',
        title: '📋 Invoice Ready',
        message: `Your medicine order invoice of ₹${totalAmount.toFixed(2)} is ready. Tap to review and pay.`,
        data: JSON.stringify({
          order_id: orderId,
          invoice_id: invoice.id,
          total_amount: totalAmount,
        }),
        is_read: false,
        requires_action: true,
        action_url: `/orders/${orderId}/invoice`,
        created_at: new Date(),
      });

      return this.success({
        success: true,
        orderId,
        invoiceId: invoice.id,
        invoice: {
          id: invoice.id,
          items,
          subtotal,
          discount,
          taxAmount,
          deliveryCharges,
          platformFee,
          convenienceFee,
          totalAmount,
          status: 'pending_approval',
        },
        message: 'Invoice sent to customer for approval',
      });
    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      return this.error(error.message || 'Failed to submit invoice', 500);
    }
  }
}

// ============================================================================
// GET BROADCAST STATUS HANDLER
// ============================================================================

class GetBroadcastStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;

    if (!orderId) {
      return this.error('Order ID is required', 400);
    }

    try {
      const { rows: orders } = await query(
        `SELECT 
          po.*,
          v.business_name as pharmacy_name,
          v.phone as pharmacy_phone,
          (
            SELECT COUNT(*) FROM pharmacy_order_notifications 
            WHERE order_id = po.id
          ) as notified_pharmacies_count
        FROM pharmacy_orders po
        LEFT JOIN vendors v ON v.id = po.pharmacy_id
        WHERE po.id = $1`,
        [orderId]
      );

      if (orders.length === 0) {
        return this.error('Order not found', 404);
      }

      const order = orders[0];

      // Check if auto-expansion needed
      if (order.broadcast_status === 'broadcasting') {
        const broadcasts = await select('pharmacy_broadcasts', { order_id: orderId });
        const broadcast = broadcasts.length > 0 ? broadcasts[0] : null;

        if (broadcast && broadcast.next_expansion_at && new Date(broadcast.next_expansion_at) < new Date()) {
          // Trigger expansion (in a real system, this would be handled by a scheduled job)
          // For now, we'll just indicate it's pending
        }
      }

      return this.success({
        success: true,
        orderId,
        status: order.status,
        broadcast: {
          status: order.broadcast_status,
          currentRadius: order.current_radius,
          notifiedPharmaciesCount: parseInt(order.notified_pharmacies_count) || 0,
          startedAt: order.broadcast_started_at,
          expiresAt: order.broadcast_expires_at,
        },
        pharmacy: order.pharmacy_id ? {
          id: order.pharmacy_id,
          name: order.pharmacy_name,
          phone: order.pharmacy_phone,
          acceptedAt: order.accepted_at,
        } : null,
        invoice: order.invoice_id ? {
          id: order.invoice_id,
          amount: order.invoice_amount,
        } : null,
      });
    } catch (error: any) {
      console.error('Error getting broadcast status:', error);
      return this.error(error.message || 'Failed to get status', 500);
    }
  }
}

// ============================================================================
// PROCESS ALL PENDING EXPANSIONS HANDLER (Server-side scheduled job endpoint)
// ============================================================================

class ProcessBroadcastExpansionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Import the expansion processor
      const { processAllPendingExpansions } = await import('../jobs/pharmacy-broadcast-expansion-processor');
      
      const results = await processAllPendingExpansions();

      return this.success({
        success: true,
        message: `Processed ${results.processedCount} broadcasts: ${results.expandedCount} expanded, ${results.expiredCount} expired, ${results.failedCount} failed`,
        ...results,
      });
    } catch (error: any) {
      console.error('Error processing broadcast expansions:', error);
      return this.error(error.message || 'Failed to process expansions', 500);
    }
  }
}

// ============================================================================
// GET EXPANSION STATUS HANDLER
// ============================================================================

class GetExpansionStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;

    if (!orderId) {
      return this.error('Order ID is required', 400);
    }

    try {
      const { getExpansionStatus } = await import('../jobs/pharmacy-broadcast-expansion-processor');
      const status = await getExpansionStatus(orderId);

      return this.success({
        success: true,
        ...status,
      });
    } catch (error: any) {
      console.error('Error getting expansion status:', error);
      return this.error(error.message || 'Failed to get expansion status', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerPharmacyBroadcastEndpoints(app: Hono) {
  const createOrderHandler = new CreatePharmacyOrderHandler();
  const expandRadiusHandler = new ExpandBroadcastRadiusHandler();
  const acceptOrderHandler = new PharmacyAcceptOrderHandler();
  const submitInvoiceHandler = new PharmacySubmitInvoiceHandler();
  const getStatusHandler = new GetBroadcastStatusHandler();
  const processExpansionsHandler = new ProcessBroadcastExpansionsHandler();
  const expansionStatusHandler = new GetExpansionStatusHandler();

  // Create pharmacy order and start broadcast
  app.post('/pharmacy/orders/create', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/pharmacy/orders/create',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast', functionVersion: '$LATEST' };
    const result = await createOrderHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Expand broadcast radius
  app.post('/pharmacy/orders/:orderId/expand-radius', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: `/pharmacy/orders/${c.req.param('orderId')}/expand-radius`,
      headers: {},
      body: '',
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast', functionVersion: '$LATEST' };
    const result = await expandRadiusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Pharmacy accept order
  app.post('/pharmacy/orders/:orderId/accept', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/pharmacy/orders/${c.req.param('orderId')}/accept`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast', functionVersion: '$LATEST' };
    const result = await acceptOrderHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Pharmacy submit invoice
  app.post('/pharmacy/orders/:orderId/invoice', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/pharmacy/orders/${c.req.param('orderId')}/invoice`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast', functionVersion: '$LATEST' };
    const result = await submitInvoiceHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get broadcast status
  app.get('/pharmacy/orders/:orderId/status', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/pharmacy/orders/${c.req.param('orderId')}/status`,
      headers: {},
      body: '',
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast', functionVersion: '$LATEST' };
    const result = await getStatusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // ============================================================================
  // SERVER-SIDE SCHEDULED JOB ENDPOINTS
  // ============================================================================

  /**
   * POST /pharmacy/broadcasts/process-expansion
   * 
   * Server-side endpoint to process all pending broadcast radius expansions.
   * Called by AWS Lambda scheduled event (EventBridge) or can be invoked manually.
   * 
   * Expansion logic:
   * - 5km → 10km (after 2 minutes)
   * - 10km → 20km (after 4 minutes)
   * - Expire (after 6 minutes if no acceptance)
   */
  app.post('/pharmacy/broadcasts/process-expansion', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: '/pharmacy/broadcasts/process-expansion',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast-expansion', functionVersion: '$LATEST' };
    const result = await processExpansionsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  /**
   * GET /pharmacy/orders/:orderId/expansion-status
   * 
   * Get the expansion status for a specific order.
   * Returns current radius, expansion count, and next expansion time.
   */
  app.get('/pharmacy/orders/:orderId/expansion-status', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/pharmacy/orders/${c.req.param('orderId')}/expansion-status`,
      headers: {},
      body: '',
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'pharmacy-broadcast', functionVersion: '$LATEST' };
    const result = await expansionStatusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
