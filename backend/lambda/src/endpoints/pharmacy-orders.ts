/**
 * ============================================================================
 * PHARMACY ORDERS - Uber-Style Broadcasting System
 * ============================================================================
 * 
 * Features:
 * - Customer places order from prescription
 * - Broadcasts to nearby pharmacies (5km → 10km → 20km)
 * - Pharmacy accepts/rejects with quote
 * - Logistics assignment (own or Warmpawz)
 * - Real-time tracking
 * - Settlement with deductions
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';
import { prescriptionOCRService } from '../lib/services/prescription-ocr-service';
import { websocketService } from '../lib/services/websocket-service';
import { sendEventNotification } from '../lib/services/push-notification-service';
import { autoAssignDeliveryPartner } from '../endpoints/delivery-partner-automation';

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate delivery fee based on logistics rules
async function calculateDeliveryFee(distanceKm: number): Promise<number> {
  try {
    const rules = await query(
      `SELECT * FROM logistics_rules 
       WHERE is_active = true 
       AND 'pharmacy' = ANY(applies_to)
       AND (min_distance_km <= $1 AND (max_distance_km IS NULL OR max_distance_km >= $1))
       ORDER BY rule_type = 'slab' DESC, min_distance_km ASC
       LIMIT 1`,
      [distanceKm]
    );
    
    if (rules.rows.length > 0) {
      const rule = rules.rows[0];
      if (rule.rule_type === 'slab') {
        return parseFloat(rule.base_fee);
      } else if (rule.rule_type === 'per_km') {
        return parseFloat(rule.base_fee) + (distanceKm * parseFloat(rule.per_km_rate));
      }
    }
    
    // Default fee if no rule found
    return 50;
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    return 50;
  }
}

// ✅ FIX GAP 6.1 & 6.2: Get configurable platform and convenience fees from admin settings
async function getConfigurableFees(serviceType: string = 'pharmacy'): Promise<{
  platformFeePercentage: number;
  convenienceFee: number;
  platformFeeFlat: number;
  maxPlatformFee: number;
}> {
  try {
    // Try to get from finance_settings or admin_settings table
    const settings = await query(
      `SELECT * FROM admin_settings 
       WHERE setting_key IN ('platform_fee_percentage', 'convenience_fee', 'platform_fee_flat', 'max_platform_fee')
       AND (service_type = $1 OR service_type = 'all' OR service_type IS NULL)`,
      [serviceType]
    ).catch(() => ({ rows: [] }));

    const settingsMap: Record<string, any> = {};
    for (const row of settings.rows) {
      settingsMap[row.setting_key] = row.setting_value;
    }

    // Try finance_rules table as fallback
    if (Object.keys(settingsMap).length === 0) {
      const financeRules = await query(
        `SELECT * FROM finance_rules 
         WHERE is_active = true 
         AND (applies_to = $1 OR applies_to = 'all')
         LIMIT 1`,
        [serviceType]
      ).catch(() => ({ rows: [] }));

      if (financeRules.rows.length > 0) {
        const rule = financeRules.rows[0];
        return {
          platformFeePercentage: parseFloat(rule.platform_fee_percentage || '2'),
          convenienceFee: parseFloat(rule.convenience_fee || '0'),
          platformFeeFlat: parseFloat(rule.platform_fee_flat || '0'),
          maxPlatformFee: parseFloat(rule.max_platform_fee || '500'),
        };
      }
    }

    return {
      platformFeePercentage: parseFloat(settingsMap['platform_fee_percentage'] || '2'),
      convenienceFee: parseFloat(settingsMap['convenience_fee'] || '0'),
      platformFeeFlat: parseFloat(settingsMap['platform_fee_flat'] || '0'),
      maxPlatformFee: parseFloat(settingsMap['max_platform_fee'] || '500'),
    };
  } catch (error) {
    console.warn('Error fetching configurable fees, using defaults:', error);
    // Return default values
    return {
      platformFeePercentage: 2,
      convenienceFee: 0,
      platformFeeFlat: 0,
      maxPlatformFee: 500,
    };
  }
}

// ✅ FIX GAP 6.1: Calculate platform fee based on configurable settings
async function calculatePlatformFee(subtotal: number, serviceType: string = 'pharmacy'): Promise<number> {
  const fees = await getConfigurableFees(serviceType);
  
  // Calculate percentage-based fee
  let platformFee = Math.round(subtotal * (fees.platformFeePercentage / 100));
  
  // Add flat fee if configured
  platformFee += fees.platformFeeFlat;
  
  // Apply max cap if configured
  if (fees.maxPlatformFee > 0 && platformFee > fees.maxPlatformFee) {
    platformFee = fees.maxPlatformFee;
  }
  
  return platformFee;
}

// ✅ FIX GAP 6.2: Get convenience fee based on configurable settings
async function getConvenienceFee(serviceType: string = 'pharmacy'): Promise<number> {
  const fees = await getConfigurableFees(serviceType);
  return fees.convenienceFee;
}

export function registerPharmacyOrderEndpoints(app: Hono) {
  
  /**
   * POST /pharmacy/orders/create
   * Create a new pharmacy order and start broadcasting
   */
  app.post("/pharmacy/orders/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        prescriptionId,
        items, // [{medicine_name, quantity, unit_price}]
        deliveryAddress, // {address, lat, lng, landmark, pincode}
        paymentMethod, // 'online' or 'cod'
        logisticsType, // 'own' or 'warmpawz'
        notes,
      } = body;

      // Validate required fields
      if (!customerId || !items || items.length === 0 || !deliveryAddress) {
        return c.json({ error: 'customerId, items, and deliveryAddress are required' }, 400);
      }

      if (!deliveryAddress.lat || !deliveryAddress.lng) {
        return c.json({ error: 'Delivery address must include lat and lng' }, 400);
      }

      // Calculate subtotal
      const subtotal = items.reduce((sum: number, item: any) => {
        return sum + (item.quantity * item.unit_price);
      }, 0);

      // Estimate delivery fee (will be finalized when pharmacy accepts)
      const estimatedDeliveryFee = await calculateDeliveryFee(5); // Start with 5km estimate

      // ✅ FIX GAP 6.1 & 6.2: Get configurable platform and convenience fees
      const platformFee = await calculatePlatformFee(subtotal, 'pharmacy');
      const convenienceFee = await getConvenienceFee('pharmacy');

      const totalAmount = subtotal + estimatedDeliveryFee + platformFee + convenienceFee;

      // Create order with configurable fees
      const orderResult = await insert('pharmacy_orders', {
        customer_id: customerId,
        prescription_id: prescriptionId || null,
        items: JSON.stringify(items),
        subtotal,
        delivery_fee: estimatedDeliveryFee,
        platform_fee: platformFee,
        convenience_fee: convenienceFee, // ✅ FIX GAP 6.2: Include convenience fee
        total_amount: totalAmount,
        delivery_address: JSON.stringify(deliveryAddress),
        customer_lat: deliveryAddress.lat,
        customer_lng: deliveryAddress.lng,
        payment_method: paymentMethod || 'online',
        logistics_type: logisticsType || 'warmpawz',
        status: 'broadcasting',
        current_broadcast_radius_km: 5,
        broadcast_started_at: new Date().toISOString(),
        broadcast_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
        notes,
      });

      const order = orderResult[0];

      // Start broadcasting to nearby pharmacies
      await broadcastToPharmacies(order.id, deliveryAddress.lat, deliveryAddress.lng, 5);

      return c.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          totalAmount: order.total_amount,
          estimatedDeliveryFee,
          broadcastRadius: 5,
        },
        message: 'Order created and broadcasting to nearby pharmacies',
      });
    } catch (error: any) {
      console.error('Error creating pharmacy order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/:orderId
   * Get order details
   */
  app.get("/pharmacy/orders/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Get pharmacy details if assigned
      let pharmacy = null;
      if (order.pharmacy_id) {
        const pharmacies = await select('vendors', { id: order.pharmacy_id });
        pharmacy = pharmacies[0] || null;
      }

      // Get tracking info
      let tracking = null;
      const trackingResult = await select('delivery_tracking', { pharmacy_order_id: orderId });
      if (trackingResult.length > 0) {
        tracking = trackingResult[0];
      }

      return c.json({
        success: true,
        order: {
          ...order,
          items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
          deliveryAddress: typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : order.delivery_address,
        },
        pharmacy,
        tracking,
      });
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/customer/:customerId
   * Get customer's orders
   */
  app.get("/pharmacy/orders/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      let queryText = `
        SELECT po.*, v.business_name as pharmacy_name, v.phone as pharmacy_phone
        FROM pharmacy_orders po
        LEFT JOIN vendors v ON po.pharmacy_id = v.id
        WHERE po.customer_id = $1
      `;
      const params: any[] = [customerId];

      if (status) {
        queryText += ` AND po.status = $2`;
        params.push(status);
      }

      queryText += ` ORDER BY po.created_at DESC`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        orders: result.rows.map((o: any) => ({
          ...o,
          items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
          deliveryAddress: typeof o.delivery_address === 'string' ? JSON.parse(o.delivery_address) : o.delivery_address,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching customer orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/broadcasts/pending/:pharmacyId
   * Get pending broadcasts for a pharmacy (for dashboard alerts)
   */
  app.get("/pharmacy/broadcasts/pending/:pharmacyId", async (c) => {
    try {
      const { pharmacyId } = c.req.param();

      const broadcasts = await query(
        `SELECT pb.*, po.items, po.subtotal, po.delivery_address, po.customer_lat, po.customer_lng,
                po.payment_method, po.notes, c.full_name as customer_name
         FROM pharmacy_broadcasts pb
         JOIN pharmacy_orders po ON pb.order_id = po.id
         LEFT JOIN customers c ON po.customer_id = c.id
         WHERE pb.pharmacy_id = $1 
         AND pb.status = 'pending'
         AND po.status = 'broadcasting'
         ORDER BY pb.broadcast_time DESC`,
        [pharmacyId]
      );

      return c.json({
        success: true,
        broadcasts: broadcasts.rows.map((b: any) => ({
          ...b,
          items: typeof b.items === 'string' ? JSON.parse(b.items) : b.items,
          deliveryAddress: typeof b.delivery_address === 'string' ? JSON.parse(b.delivery_address) : b.delivery_address,
        })),
        count: broadcasts.rows.length,
        // Include alert flag for UI
        hasNewOrders: broadcasts.rows.length > 0,
      });
    } catch (error: any) {
      console.error('Error fetching pending broadcasts:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/broadcasts/:broadcastId/accept
   * Pharmacy accepts an order
   */
  app.post("/pharmacy/broadcasts/:broadcastId/accept", async (c) => {
    try {
      const { broadcastId } = c.req.param();
      const { quotedDeliveryFee, quotedEtaMinutes, useOwnLogistics } = await c.req.json();

      // Get broadcast
      const broadcasts = await select('pharmacy_broadcasts', { id: broadcastId });
      if (broadcasts.length === 0) {
        return c.json({ error: 'Broadcast not found' }, 404);
      }

      const broadcast = broadcasts[0];

      // Check if already accepted by another pharmacy
      const order = (await select('pharmacy_orders', { id: broadcast.order_id }))[0];
      if (order.status !== 'broadcasting') {
        return c.json({ error: 'Order is no longer available', code: 'ORDER_TAKEN' }, 409);
      }

      // Update broadcast
      await update('pharmacy_broadcasts', { id: broadcastId }, {
        status: 'accepted',
        response_time: new Date().toISOString(),
        quoted_delivery_fee: quotedDeliveryFee || broadcast.distance_from_customer * 10,
        quoted_eta_minutes: quotedEtaMinutes || 45,
      });

      // Calculate final delivery fee
      const finalDeliveryFee = quotedDeliveryFee || await calculateDeliveryFee(broadcast.distance_from_customer);
      const logisticsType = useOwnLogistics ? 'own' : 'warmpawz';
      const logisticsCost = logisticsType === 'warmpawz' ? finalDeliveryFee : 0;

      // Update order
      await update('pharmacy_orders', { id: broadcast.order_id }, {
        pharmacy_id: broadcast.pharmacy_id,
        status: 'accepted',
        delivery_fee: finalDeliveryFee,
        total_amount: order.subtotal + finalDeliveryFee + order.platform_fee,
        logistics_type: logisticsType,
        logistics_cost: logisticsCost,
        accepted_at: new Date().toISOString(),
        estimated_delivery_time: new Date(Date.now() + (quotedEtaMinutes || 45) * 60 * 1000).toISOString(),
      });

      // Reject all other broadcasts for this order
      await query(
        `UPDATE pharmacy_broadcasts 
         SET status = 'auto_rejected', response_time = NOW()
         WHERE order_id = $1 AND id != $2 AND status = 'pending'`,
        [broadcast.order_id, broadcastId]
      );

      // Deduct inventory if items are available
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (items && Array.isArray(items)) {
          // Deduct inventory directly from database
          for (const item of items) {
            const medicineName = item.medicine_name || item.name;
            const quantity = item.quantity;

            // Find and deduct from inventory
            await query(
              `UPDATE pharmacy_inventory 
               SET current_stock = current_stock - $1,
                   updated_at = NOW()
               WHERE vendor_id = $2 
               AND (medicine_name = $3 OR medicine_id IN (SELECT id FROM medicines WHERE name = $3))
               AND is_active = true
               AND current_stock >= $1
               RETURNING id, current_stock, low_stock_threshold`,
              [quantity, broadcast.pharmacy_id, medicineName]
            );

            // Check for low stock and send alert
            const inventoryCheck = await query(
              `SELECT current_stock, low_stock_threshold, medicine_name 
               FROM pharmacy_inventory 
               WHERE vendor_id = $1 
               AND (medicine_name = $2 OR medicine_id IN (SELECT id FROM medicines WHERE name = $2))
               AND is_active = true
               LIMIT 1`,
              [broadcast.pharmacy_id, medicineName]
            );

            if ((inventoryCheck as any).rows.length > 0) {
              const inv = (inventoryCheck as any).rows[0];
              if (inv.current_stock <= inv.low_stock_threshold) {
                await sendEventNotification({
                  eventType: 'pharmacy_order_preparing',
                  recipientId: broadcast.pharmacy_id,
                  recipientType: 'vendor',
                  data: {
                    message: `Low stock alert: ${inv.medicine_name} is running low (${inv.current_stock} remaining)`,
                  },
                });
              }
            }
          }
        }
      } catch (inventoryError) {
        console.warn('Inventory deduction failed:', inventoryError);
        // Don't fail the order acceptance if inventory deduction fails
      }

      // Send WebSocket notification to customer
      await websocketService.sendOrderStatusUpdate(
        broadcast.order_id,
        'pharmacy',
        'accepted',
        {
          pharmacyId: broadcast.pharmacy_id,
          estimatedEta: quotedEtaMinutes || 45,
        }
      );

      // Send push notification
      await sendEventNotification({
        eventType: 'pharmacy_order_accepted',
        recipientId: order.customer_id,
        recipientType: 'customer',
        relatedId: broadcast.order_id,
        data: {
          pharmacyId: broadcast.pharmacy_id,
          estimatedEta: quotedEtaMinutes || 45,
        },
      });

      return c.json({
        success: true,
        message: 'Order accepted successfully',
        order: {
          id: broadcast.order_id,
          deliveryFee: finalDeliveryFee,
          estimatedEta: quotedEtaMinutes || 45,
          logisticsType,
        },
      });
    } catch (error: any) {
      console.error('Error accepting order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/broadcasts/:broadcastId/reject
   * Pharmacy rejects an order
   */
  app.post("/pharmacy/broadcasts/:broadcastId/reject", async (c) => {
    try {
      const { broadcastId } = c.req.param();
      const { reason } = await c.req.json();

      await update('pharmacy_broadcasts', { id: broadcastId }, {
        status: 'rejected',
        response_time: new Date().toISOString(),
        rejection_reason: reason || 'Not available',
      });

      return c.json({
        success: true,
        message: 'Order rejected',
      });
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/update-status
   * Update order status (preparing, ready, etc.)
   */
  app.post("/pharmacy/orders/:orderId/update-status", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, notes } = await c.req.json();

      const validStatuses = ['preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const updateData: Record<string, any> = { status };

      if (status === 'preparing') updateData.prepared_at = new Date().toISOString();
      if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString();
      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
        updateData.actual_delivery_time = new Date().toISOString();
      }
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = notes;
      }

      await update('pharmacy_orders', { id: orderId }, updateData);

      // Send WebSocket notification
      await websocketService.sendOrderStatusUpdate(
        orderId,
        'pharmacy',
        status,
        { notes }
      );

      // Send push notification
      const order = (await select('pharmacy_orders', { id: orderId }))[0];
      if (order) {
        await sendEventNotification({
          eventType: status === 'dispatched' ? 'pharmacy_order_dispatched' :
                     status === 'delivered' ? 'pharmacy_order_delivered' :
                     'pharmacy_order_preparing',
          recipientId: order.customer_id,
          recipientType: 'customer',
          relatedId: orderId,
          data: { status, notes },
        });
      }

      // Auto-assign delivery partner if ready and using Warmpawz logistics
      if (status === 'ready_for_pickup' && order.logistics_type === 'warmpawz') {
        try {
          const deliveryAddress = typeof order.delivery_address === 'string' 
            ? JSON.parse(order.delivery_address) 
            : order.delivery_address;
          
          const pharmacy = (await select('vendors', { id: order.pharmacy_id }))[0];
          
          if (pharmacy && deliveryAddress && pharmacy.latitude && pharmacy.longitude) {
            const assignment = await autoAssignDeliveryPartner(
              orderId,
              'pharmacy',
              {
                lat: pharmacy.latitude,
                lng: pharmacy.longitude,
              },
              {
                lat: deliveryAddress.lat || order.customer_lat,
                lng: deliveryAddress.lng || order.customer_lng,
              },
              'normal'
            );

            if (assignment) {
              // Send notification to delivery partner
              await sendEventNotification({
                eventType: 'pharmacy_order_dispatched',
                recipientId: assignment.partner.id,
                recipientType: 'vendor',
                relatedId: orderId,
                data: {
                  orderId,
                  assignmentId: assignment.assignment.id,
                },
              });

              // Update order with assignment
              await update('pharmacy_orders', { id: orderId }, {
                delivery_assignment_id: assignment.assignment.id,
                delivery_partner_id: assignment.partner.id,
              });
            }
          }
        } catch (deliveryError) {
          console.warn('Auto-assign delivery partner failed:', deliveryError);
        }
      }

      // If delivered, create settlement record
      if (status === 'delivered') {
        await createSettlementRecord(orderId, 'pharmacy');
      }

      return c.json({
        success: true,
        message: `Order status updated to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating order status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/invoice
   * Generate proforma invoice
   */
  app.post("/pharmacy/orders/:orderId/invoice", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { invoiceItems } = await c.req.json(); // Pharmacy can adjust items/prices

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Calculate new totals if items provided
      let items = invoiceItems || (typeof order.items === 'string' ? JSON.parse(order.items) : order.items);
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const totalAmount = subtotal + parseFloat(order.delivery_fee) + parseFloat(order.platform_fee);

      // Update order with invoice items
      await update('pharmacy_orders', { id: orderId }, {
        items: JSON.stringify(items),
        subtotal,
        total_amount: totalAmount,
      });

      return c.json({
        success: true,
        invoice: {
          orderId,
          orderNumber: order.order_number,
          items,
          subtotal,
          deliveryFee: parseFloat(order.delivery_fee),
          platformFee: parseFloat(order.platform_fee),
          totalAmount,
          paymentMethod: order.payment_method,
        },
      });
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/expand-broadcast
   * Expand broadcast radius (called by cron or manually)
   */
  app.post("/pharmacy/orders/:orderId/expand-broadcast", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0 || orders[0].status !== 'broadcasting') {
        return c.json({ error: 'Order not found or not broadcasting' }, 404);
      }

      const order = orders[0];
      let newRadius = order.current_broadcast_radius_km;

      // Expand radius: 5 → 10 → 20
      if (newRadius === 5) newRadius = 10;
      else if (newRadius === 10) newRadius = 20;
      else {
        // Max radius reached, cancel order
        await update('pharmacy_orders', { id: orderId }, {
          status: 'cancelled',
          cancellation_reason: 'No pharmacy accepted within 20km radius',
          cancelled_at: new Date().toISOString(),
        });
        return c.json({
          success: false,
          message: 'No pharmacy found within 20km. Order cancelled.',
        });
      }

      // Update order radius
      await update('pharmacy_orders', { id: orderId }, {
        current_broadcast_radius_km: newRadius,
        broadcast_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 more minutes
      });

      // Broadcast to new pharmacies in expanded radius
      await broadcastToPharmacies(orderId, order.customer_lat, order.customer_lng, newRadius);

      return c.json({
        success: true,
        message: `Broadcast expanded to ${newRadius}km`,
        newRadius,
      });
    } catch (error: any) {
      console.error('Error expanding broadcast:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR PHARMACY DASHBOARD ENDPOINTS
  // ============================================================================

  /**
   * GET /pharmacy/orders/incoming/:vendorId
   * Get incoming/broadcasting orders for a pharmacy vendor
   */
  app.get("/pharmacy/orders/incoming/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get orders that have been broadcasted to this pharmacy
      const result = await query(
        `SELECT 
          po.id as order_id,
          po.customer_id,
          po.prescription_id,
          po.items,
          po.subtotal,
          po.delivery_fee,
          po.platform_fee,
          po.total_amount,
          po.delivery_address,
          po.customer_lat,
          po.customer_lng,
          po.payment_method,
          po.status,
          po.notes,
          po.created_at,
          pb.id as broadcast_id,
          pb.distance_from_customer,
          pb.radius_km,
          pb.broadcast_time,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM pharmacy_orders po
        INNER JOIN pharmacy_broadcasts pb ON pb.order_id = po.id
        LEFT JOIN customers c ON c.id = po.customer_id
        WHERE pb.pharmacy_id = $1
          AND pb.status = 'pending'
          AND po.status = 'broadcasting'
        ORDER BY po.created_at DESC`,
        [vendorId]
      );

      const orders = result.rows.map((row: any) => ({
        ...row,
        items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
        delivery_address: typeof row.delivery_address === 'string' ? JSON.parse(row.delivery_address) : row.delivery_address,
      }));

      return c.json({
        success: true,
        orders,
        count: orders.length,
      });
    } catch (error: any) {
      console.error('Error fetching incoming pharmacy orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/:vendorId/orders
   * Get pharmacy orders by vendor with status filter
   */
  app.get("/pharmacy/:vendorId/orders", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const statusFilter = c.req.query('status');

      let queryStr = `
        SELECT 
          po.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          dt.status as delivery_status,
          dt.delivery_person_name,
          dt.delivery_person_phone,
          dt.current_lat,
          dt.current_lng,
          dt.eta_to_delivery_minutes
        FROM pharmacy_orders po
        LEFT JOIN customers c ON c.id = po.customer_id
        LEFT JOIN delivery_tracking dt ON dt.pharmacy_order_id = po.id
        WHERE po.pharmacy_id = $1
      `;

      const params: any[] = [vendorId];

      if (statusFilter) {
        const statuses = statusFilter.split(',').map(s => s.trim());
        queryStr += ` AND po.status = ANY($2::text[])`;
        params.push(statuses);
      }

      queryStr += ` ORDER BY po.created_at DESC`;

      const result = await query(queryStr, params);

      const orders = result.rows.map((row: any) => ({
        ...row,
        items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
        delivery_address: typeof row.delivery_address === 'string' ? JSON.parse(row.delivery_address) : row.delivery_address,
      }));

      return c.json({
        success: true,
        orders,
        count: orders.length,
      });
    } catch (error: any) {
      console.error('Error fetching pharmacy orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/reject
   * Reject a pharmacy order
   */
  app.post("/pharmacy/orders/:orderId/reject", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { pharmacyId, reason } = await c.req.json();

      // Find the broadcast for this pharmacy
      if (pharmacyId) {
        const broadcasts = await query(
          `SELECT id FROM pharmacy_broadcasts WHERE order_id = $1 AND pharmacy_id = $2 AND status = 'pending'`,
          [orderId, pharmacyId]
        );

        if (broadcasts.rows.length > 0) {
          await update('pharmacy_broadcasts', { id: broadcasts.rows[0].id }, {
            status: 'rejected',
            response_time: new Date().toISOString(),
            rejection_reason: reason || 'Not available',
          });
        }
      }

      // Update order status if it was already accepted by this pharmacy
      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length > 0 && orders[0].pharmacy_id === pharmacyId) {
        await update('pharmacy_orders', { id: orderId }, {
          status: 'cancelled',
          cancellation_reason: reason || 'Rejected by pharmacy',
          cancelled_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Order rejected',
      });
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/dispatch
   * Dispatch a pharmacy order for delivery
   */
  app.post("/pharmacy/orders/:orderId/dispatch", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { deliveryPartner, deliveryPartnerName, deliveryPartnerPhone, vehicleNumber } = await c.req.json();

      // Update order status
      await update('pharmacy_orders', { id: orderId }, {
        status: 'dispatched',
        dispatched_at: new Date().toISOString(),
      });

      // Create or update delivery tracking if using own delivery
      if (deliveryPartner === 'Own Fleet' || deliveryPartnerName) {
        // Generate delivery OTP
        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

        // Check if tracking record exists
        const existingTracking = await select('delivery_tracking', { pharmacy_order_id: orderId });

        if (existingTracking.length > 0) {
          await update('delivery_tracking', { id: existingTracking[0].id }, {
            status: 'picked_up',
            delivery_person_name: deliveryPartnerName || 'Pharmacy Delivery',
            delivery_person_phone: deliveryPartnerPhone || null,
            vehicle_number: vehicleNumber || null,
            picked_up_at: new Date().toISOString(),
          });
        } else {
          await insert('delivery_tracking', {
            pharmacy_order_id: orderId,
            status: 'picked_up',
            delivery_otp: deliveryOtp,
            delivery_person_name: deliveryPartnerName || 'Pharmacy Delivery',
            delivery_person_phone: deliveryPartnerPhone || null,
            vehicle_number: vehicleNumber || null,
            assigned_at: new Date().toISOString(),
            picked_up_at: new Date().toISOString(),
          });
        }
      }

      return c.json({
        success: true,
        message: 'Order dispatched for delivery',
      });
    } catch (error: any) {
      console.error('Error dispatching order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/complete
   * Complete a pharmacy order delivery
   */
  app.post("/pharmacy/orders/:orderId/complete", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { otp, deliveryNotes } = await c.req.json();

      // Verify OTP if provided
      if (otp) {
        const tracking = await select('delivery_tracking', { pharmacy_order_id: orderId });
        if (tracking.length > 0 && tracking[0].delivery_otp !== otp) {
          return c.json({ error: 'Invalid delivery OTP', code: 'INVALID_OTP' }, 400);
        }
      }

      // Update order status
      await update('pharmacy_orders', { id: orderId }, {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        actual_delivery_time: new Date().toISOString(),
      });

      // Update delivery tracking
      const tracking = await select('delivery_tracking', { pharmacy_order_id: orderId });
      if (tracking.length > 0) {
        await update('delivery_tracking', { id: tracking[0].id }, {
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivery_notes: deliveryNotes || null,
        });
      }

      // Create settlement record
      await createSettlementRecord(orderId, 'pharmacy');

      return c.json({
        success: true,
        message: 'Order completed successfully',
      });
    } catch (error: any) {
      console.error('Error completing order:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

/**
 * Broadcast order to pharmacies within radius
 */
async function broadcastToPharmacies(orderId: string, customerLat: number, customerLng: number, radiusKm: number) {
  try {
    // Find pharmacies within radius
    // Note: This uses a simple bounding box query, then filters by actual distance
    const latDiff = radiusKm / 111; // Approx 111km per degree latitude
    const lngDiff = radiusKm / (111 * Math.cos(customerLat * Math.PI / 180));

    const pharmacies = await query(
      `SELECT v.id, v.business_name, v.phone, v.address, 
              CAST(v.metadata->>'lat' AS NUMERIC) as lat, 
              CAST(v.metadata->>'lng' AS NUMERIC) as lng
       FROM vendors v
       WHERE v.role_id IN (SELECT id FROM roles WHERE name ILIKE '%pharmacy%')
       AND v.is_active = true
       AND v.status = 'approved'
       AND CAST(v.metadata->>'lat' AS NUMERIC) BETWEEN $1 AND $2
       AND CAST(v.metadata->>'lng' AS NUMERIC) BETWEEN $3 AND $4`,
      [
        customerLat - latDiff, customerLat + latDiff,
        customerLng - lngDiff, customerLng + lngDiff
      ]
    );

    console.log(`📍 Found ${pharmacies.rows.length} potential pharmacies in bounding box`);

    // Filter by actual distance and create broadcasts
    for (const pharmacy of pharmacies.rows) {
      if (!pharmacy.lat || !pharmacy.lng) continue;

      const distance = calculateDistance(customerLat, customerLng, pharmacy.lat, pharmacy.lng);
      
      if (distance <= radiusKm) {
        // Check if already broadcasted
        const existing = await query(
          `SELECT id FROM pharmacy_broadcasts WHERE order_id = $1 AND pharmacy_id = $2`,
          [orderId, pharmacy.id]
        );

        if (existing.rows.length === 0) {
          await insert('pharmacy_broadcasts', {
            order_id: orderId,
            pharmacy_id: pharmacy.id,
            radius_km: radiusKm,
            distance_from_customer: Math.round(distance * 100) / 100,
            status: 'pending',
            expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 min expiry per broadcast
          });
          console.log(`📤 Broadcasted to ${pharmacy.business_name} (${distance.toFixed(2)}km)`);

          // ✅ FIX GAP PH-1: Send push notification to pharmacy
          try {
            const { pushNotificationService } = await import('../lib/services/push-notification-service');
            
            // Get customer name for notification
            const customers = await select('customers', { id: await getOrderCustomerId(orderId) });
            const customerName = customers[0]?.name || 'A customer';
            
            // Get item count
            const orders = await select('pharmacy_orders', { id: orderId });
            const items = orders[0]?.items ? 
              (typeof orders[0].items === 'string' ? JSON.parse(orders[0].items) : orders[0].items) : [];
            const itemCount = items.length;

            await pushNotificationService.sendUrgentNotification(
              {
                userId: pharmacy.id,
                userType: 'vendor',
                phone: pharmacy.phone,
              },
              {
                title: '💊 New Pharmacy Order!',
                body: `New order from ${customerName}. ${itemCount} items. Accept within 2 minutes.`,
                sound: 'urgent',
                priority: 'high',
                data: {
                  orderId,
                  distance: Math.round(distance * 100) / 100,
                  itemCount,
                  expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
                },
              }
            );
            console.log(`🔔 Push notification sent to ${pharmacy.business_name}`);
          } catch (notifError) {
            console.warn(`Failed to send push notification to ${pharmacy.business_name}:`, notifError);
            // Continue - notification failure shouldn't block the broadcast
          }
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting to pharmacies:', error);
  }
}

/**
 * Create settlement record when order is delivered
 * ✅ FIX GAP PM-5: Tier-based commission properly applied
 */
async function createSettlementRecord(orderId: string, orderType: 'pharmacy' | 'meal') {
  try {
    const tableName = orderType === 'pharmacy' ? 'pharmacy_orders' : 'meal_orders';
    const orderIdColumn = orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';

    const orders = await query(`SELECT * FROM ${tableName} WHERE id = $1`, [orderId]);
    if (orders.rows.length === 0) return;

    const order = orders.rows[0];
    const vendorId = orderType === 'pharmacy' ? order.pharmacy_id : order.vendor_id;

    // ✅ FIX: Get vendor with tier-based commission
    // Priority: 1. Commission tier rate, 2. Vendor custom rate, 3. Default tier rate
    const vendors = await query(
      `SELECT v.*, 
              v.commission_rate as vendor_commission_rate,
              ct.default_commission_rate as tier_default_rate,
              ct.pharmacy_commission_rate as tier_pharmacy_rate,
              ct.ecommerce_commission_rate as tier_ecommerce_rate,
              ct.tier_name,
              ct.tier_level
       FROM vendors v 
       LEFT JOIN commission_tiers ct ON v.commission_tier_id = ct.id
       WHERE v.id = $1`,
      [vendorId]
    );

    const vendor = vendors.rows[0];
    
    // Determine commission rate based on tier and order type
    let commissionRate: number;
    
    if (orderType === 'pharmacy' && vendor?.tier_pharmacy_rate) {
      // Use tier-specific pharmacy commission rate
      commissionRate = parseFloat(vendor.tier_pharmacy_rate);
    } else if (orderType === 'meal' && vendor?.tier_ecommerce_rate) {
      // Use tier-specific ecommerce rate for meals
      commissionRate = parseFloat(vendor.tier_ecommerce_rate);
    } else if (vendor?.tier_default_rate) {
      // Use tier's default commission rate
      commissionRate = parseFloat(vendor.tier_default_rate);
    } else if (vendor?.vendor_commission_rate) {
      // Use vendor's custom commission rate
      commissionRate = parseFloat(vendor.vendor_commission_rate);
    } else {
      // Fallback to platform default
      commissionRate = 15.0; // 15% default
    }

    const orderAmount = parseFloat(order.total_amount);
    const deliveryFee = parseFloat(order.delivery_fee || '0');
    const platformFee = parseFloat(order.platform_fee || '0');
    const convenienceFee = parseFloat(order.convenience_fee || '0');
    const logisticsCost = order.logistics_type === 'warmpawz' ? parseFloat(order.logistics_cost || '0') : 0;
    
    // Commission applies on base order amount (excluding delivery, platform, convenience fees)
    const commissionableAmount = orderAmount - deliveryFee - platformFee - convenienceFee;
    const commissionAmount = Math.round(commissionableAmount * commissionRate / 100);
    const netPayout = orderAmount - commissionAmount - platformFee - convenienceFee - logisticsCost;

    await insert('delivery_settlements', {
      [orderIdColumn]: orderId,
      vendor_id: vendorId,
      order_amount: orderAmount,
      delivery_fee_collected: deliveryFee,
      platform_fee: platformFee,
      convenience_fee: convenienceFee,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      logistics_cost: logisticsCost,
      net_payout: netPayout,
      status: 'pending',
      order_delivered_at: new Date().toISOString(),
      tier_name: vendor?.tier_name || null,
      tier_level: vendor?.tier_level || null,
    });

    console.log(`💰 Settlement created for ${orderType} order ${orderId}: ₹${netPayout} (${commissionRate}% commission, tier: ${vendor?.tier_name || 'default'})`);
  } catch (error) {
    console.error('Error creating settlement record:', error);
  }
}

/**
 * Helper to get customer ID from order
 */
async function getOrderCustomerId(orderId: string): Promise<string> {
  try {
    const orders = await select('pharmacy_orders', { id: orderId });
    return orders[0]?.customer_id || '';
  } catch (error) {
    return '';
  }
}

/**
 * ✅ FIX GAP PH-4, PH-6: Send order status notification to customer
 * Sends push notification for status changes
 */
async function sendOrderStatusNotification(
  orderId: string, 
  status: string, 
  additionalData?: Record<string, any>
): Promise<void> {
  try {
    const orders = await select('pharmacy_orders', { id: orderId });
    if (orders.length === 0) return;
    
    const order = orders[0];
    
    // Get pharmacy name if assigned
    let pharmacyName = 'Pharmacy';
    if (order.pharmacy_id) {
      const pharmacies = await select('vendors', { id: order.pharmacy_id });
      pharmacyName = pharmacies[0]?.business_name || 'Pharmacy';
    }

    const { pushNotificationService } = await import('../lib/services/push-notification-service');

    const statusNotifications: Record<string, { eventType: any; title: string; body: string }> = {
      'accepted': {
        eventType: 'pharmacy_order_accepted',
        title: '✅ Order Accepted',
        body: `${pharmacyName} has accepted your order. Preparing now...`,
      },
      'preparing': {
        eventType: 'pharmacy_order_preparing',
        title: '⏳ Order Being Prepared',
        body: `Your order is being prepared at ${pharmacyName}.`,
      },
      'ready': {
        eventType: 'pharmacy_order_ready',
        title: '📦 Order Ready for Pickup',
        body: 'Your order is ready! Delivery partner will pick up soon.',
      },
      'dispatched': {
        eventType: 'pharmacy_order_dispatched',
        title: '🚴 Order Dispatched!',
        body: `Your order is on the way. ${additionalData?.trackingUrl ? 'Tap to track.' : ''}`,
      },
      'delivered': {
        eventType: 'pharmacy_order_delivered',
        title: '🎉 Order Delivered!',
        body: 'Your pharmacy order has been delivered. Thank you for using Warmpawz!',
      },
    };

    const notification = statusNotifications[status];
    if (!notification) return;

    await pushNotificationService.sendEventNotification({
      eventType: notification.eventType,
      recipientId: order.customer_id,
      recipientType: 'customer',
      relatedId: orderId,
      data: {
        orderId,
        status,
        pharmacyName,
        ...additionalData,
      },
    });

    console.log(`📱 Status notification sent to customer for order ${orderId}: ${status}`);
  } catch (error) {
    console.warn('Failed to send order status notification:', error);
  }
}
