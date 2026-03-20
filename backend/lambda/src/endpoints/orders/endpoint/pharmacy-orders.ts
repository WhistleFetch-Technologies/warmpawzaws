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
import { select, insert, update, query } from '../../../database/rds-connection';
import { isValidUUID } from '../../../types/entities';
import { getDiscoveryRules, getRuleNumberArray } from '../../../lib/rule-engine';
import { prescriptionOCRService } from '../../../lib/services/prescription-ocr-service';
import { websocketService } from '../../../lib/services/websocket-service';
import { sendEventNotification } from '../../../aws/aws-sns-notification-service';
import { autoAssignDeliveryPartner } from '../../delivery-partner-automation';
import { createPharmacyOrderRequestSchema, approveInvoiceRequestSchema } from '../../../zodContracts/orders.contract';
import { uuidSchema } from '../../../middleware/validation-middleware';
import { verifyPayment, requiresPayment } from '../../../utils/payments/payment-verification-service';

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

  // Ensure required columns exist (runtime migration fallback)
  const ensureColumnsExist = async () => {
    try {
      await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20)`);
      await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS prescription_url TEXT`);
      await query(`ALTER TABLE pharmacy_broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
      // Drop problematic trigger if it exists
      await query(`DROP TRIGGER IF EXISTS trigger_update_pharmacy_broadcasts_updated_at ON pharmacy_broadcasts`);
    } catch (e) { /* Columns may already exist */ }
  };
  ensureColumnsExist().catch(console.error);

  /**
   * POST /pharmacy/orders/create
   * Create a new pharmacy order and start broadcasting
   */
  app.post("/pharmacy/orders/create", async (c) => {
    try {
      const body = await c.req.json();
      let {
        customerId,
        customerPhone,
        prescriptionId,
        prescriptionUrl,
        items, // [{medicine_name, quantity, unit_price}] - Optional if prescription is provided
        deliveryAddress, // {address, lat, lng, landmark, pincode, latitude?, longitude?}
        paymentMethod, // 'online' or 'cod'
        logisticsType, // 'own' or 'warmpawz'
        notes,
      } = body;

      // Resolve customer_id: require customerId OR customerPhone; if only phone, get-or-create customer
      if (!customerId && customerPhone) {
        const customers = await select('customers', { phone: String(customerPhone).trim() });
        if (customers.length > 0) {
          customerId = customers[0].id;
        } else {
          const newCustomer = await insert('customers', {
            phone: String(customerPhone).trim(),
            full_name: 'Customer',
            created_at: new Date().toISOString(),
          });
          const row = Array.isArray(newCustomer) ? newCustomer[0] : newCustomer;
          customerId = row?.id;
          if (!customerId) throw new Error('Failed to create customer');
        }
      }

      // Validate required fields - either items OR prescription is required
      if (!customerId || !deliveryAddress) {
        return c.json({ error: 'customerId (or customerPhone) and deliveryAddress are required' }, 400);
      }

      // Must have either items or prescription reference
      const hasItems = items && items.length > 0;
      const hasPrescription = prescriptionId || prescriptionUrl;
      if (!hasItems && !hasPrescription) {
        return c.json({ error: 'Either items or prescription (prescriptionId/prescriptionUrl) is required' }, 400);
      }

      // Support both lat/lng and latitude/longitude formats
      const customerLat = deliveryAddress.lat || deliveryAddress.latitude;
      const customerLng = deliveryAddress.lng || deliveryAddress.longitude;

      if (!customerLat || !customerLng) {
        return c.json({ error: 'Delivery address must include coordinates (lat/lng or latitude/longitude)' }, 400);
      }

      // Calculate subtotal (0 if prescription-only order - pharmacy will set price)
      const subtotal = hasItems ? items.reduce((sum: number, item: any) => {
        return sum + ((item.quantity || 1) * (item.unit_price || item.price || 0));
      }, 0) : 0;

      const rules = await getDiscoveryRules('pharmacy', 'pharmacy_broadcast');
      const initialRadiusKm = rules.broadcast_radius_km_initial ?? 5;
      const steps = await getRuleNumberArray('pharmacy', 'broadcast_radius_km_steps', 'pharmacy_broadcast');
      const maxRadiusKm = steps.length > 0 ? steps[steps.length - 1] : 20;

      // Estimate delivery fee (will be finalized when pharmacy accepts)
      const estimatedDeliveryFee = await calculateDeliveryFee(initialRadiusKm);

      // ✅ FIX GAP 6.1 & 6.2: Get configurable platform and convenience fees
      const platformFee = await calculatePlatformFee(subtotal, 'pharmacy');
      const convenienceFee = await getConvenienceFee('pharmacy');

      const totalAmount = subtotal + estimatedDeliveryFee + platformFee + convenienceFee;

      // Create order with configurable fees and expansion tracking (rule engine: initial radius)
      const orderResult = await insert('pharmacy_orders', {
        customer_id: customerId,
        customer_phone: customerPhone || customerId,
        prescription_id: prescriptionId || null,
        prescription_url: prescriptionUrl || null,
        items: JSON.stringify(items || []),
        subtotal,
        delivery_fee: estimatedDeliveryFee,
        platform_fee: platformFee,
        convenience_fee: convenienceFee, // ✅ FIX GAP 6.2: Include convenience fee
        total_amount: totalAmount,
        delivery_address: JSON.stringify({
          ...deliveryAddress,
          lat: customerLat,
          lng: customerLng,
        }),
        customer_lat: customerLat,
        customer_lng: customerLng,
        payment_method: paymentMethod || 'online',
        logistics_type: logisticsType || 'warmpawz',
        status: 'broadcasting',
        current_broadcast_radius_km: initialRadiusKm,
        broadcast_started_at: new Date().toISOString(),
        broadcast_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
        last_expanded_at: null, // Will be set by server-side expansion processor
        expansion_count: 0, // Track number of radius expansions
        notes,
      });

      const order = orderResult[0];

      // Start broadcasting to nearby pharmacies (rule engine: initial radius)
      await broadcastToPharmacies(order.id, customerLat, customerLng, initialRadiusKm);

      return c.json({
        success: true,
        orderId: order.id,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          totalAmount: order.total_amount,
          estimatedDeliveryFee,
          broadcastRadius: initialRadiusKm,
        },
        broadcast: {
          status: 'broadcasting',
          currentRadius: initialRadiusKm,
          notifiedPharmaciesCount: 0, // Will be updated by broadcast
          startedAt: order.broadcast_started_at,
          expiresAt: order.broadcast_expires_at,
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

      // Update order - parse numeric values from DB strings
      const subtotal = parseFloat(order.subtotal) || 0;
      const platformFee = parseFloat(order.platform_fee) || 0;
      const newTotal = subtotal + finalDeliveryFee + platformFee;

      await update('pharmacy_orders', { id: broadcast.order_id }, {
        pharmacy_id: broadcast.pharmacy_id,
        status: 'accepted',
        delivery_fee: finalDeliveryFee,
        total_amount: newTotal,
        logistics_type: logisticsType,
        logistics_cost: logisticsCost,
        accepted_at: new Date().toISOString(),
        estimated_delivery_time: new Date(Date.now() + (quotedEtaMinutes || 45) * 60 * 1000).toISOString(),
      });

      // Reject all other broadcasts for this order (use 'rejected' which is in the CHECK constraint)
      await query(
        `UPDATE pharmacy_broadcasts 
         SET status = 'rejected', response_time = NOW(), rejection_reason = 'Another pharmacy accepted'
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
   * POST /pharmacy/orders/:orderId/accept
   * Pharmacy accepts an order by orderId (resolves broadcast for this pharmacy)
   * Body: { pharmacyId, quotedDeliveryFee?, quotedEtaMinutes?, useOwnLogistics? } or legacy { availableItems, unavailableItems }
   */
  app.post("/pharmacy/orders/:orderId/accept", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const pharmacyId = body.pharmacyId;
      const quotedDeliveryFee = body.quotedDeliveryFee;
      const quotedEtaMinutes = body.quotedEtaMinutes ?? 45;
      const useOwnLogistics = body.useOwnLogistics ?? false;

      if (!pharmacyId) {
        return c.json({ error: 'pharmacyId is required' }, 400);
      }

      const broadcastResult = await query(
        `SELECT id, order_id, pharmacy_id, distance_from_customer FROM pharmacy_broadcasts 
         WHERE order_id = $1 AND pharmacy_id = $2 AND status = 'pending' LIMIT 1`,
        [orderId, pharmacyId]
      );
      if (!broadcastResult.rows || broadcastResult.rows.length === 0) {
        return c.json({ error: 'No pending broadcast found for this order and pharmacy' }, 404);
      }
      const broadcast = broadcastResult.rows[0];
      const broadcastId = broadcast.id;

      const broadcasts = await select('pharmacy_broadcasts', { id: broadcastId });
      if (broadcasts.length === 0) {
        return c.json({ error: 'Broadcast not found' }, 404);
      }
      const broadcastRow = broadcasts[0];

      const orders = await select('pharmacy_orders', { id: broadcastRow.order_id });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }
      const order = orders[0];
      if (order.status !== 'broadcasting') {
        return c.json({ error: 'Order is no longer available', code: 'ORDER_TAKEN' }, 409);
      }

      await update('pharmacy_broadcasts', { id: broadcastId }, {
        status: 'accepted',
        response_time: new Date().toISOString(),
        quoted_delivery_fee: quotedDeliveryFee ?? broadcastRow.distance_from_customer * 10,
        quoted_eta_minutes: quotedEtaMinutes,
      });

      const finalDeliveryFee = quotedDeliveryFee ?? await calculateDeliveryFee(broadcastRow.distance_from_customer);
      const logisticsType = useOwnLogistics ? 'own' : 'warmpawz';
      const logisticsCost = logisticsType === 'warmpawz' ? finalDeliveryFee : 0;
      const subtotal = parseFloat(order.subtotal) || 0;
      const platformFee = parseFloat(order.platform_fee) || 0;
      const convenienceFee = parseFloat(order.convenience_fee || '0') || 0;
      const newTotal = subtotal + finalDeliveryFee + platformFee + convenienceFee;

      await update('pharmacy_orders', { id: broadcastRow.order_id }, {
        pharmacy_id: pharmacyId,
        status: 'accepted',
        delivery_fee: finalDeliveryFee,
        total_amount: newTotal,
        logistics_type: logisticsType,
        logistics_cost: logisticsCost,
        accepted_at: new Date().toISOString(),
        estimated_delivery_time: new Date(Date.now() + quotedEtaMinutes * 60 * 1000).toISOString(),
      });

      await query(
        `UPDATE pharmacy_broadcasts 
         SET status = 'rejected', response_time = NOW(), rejection_reason = 'Another pharmacy accepted'
         WHERE order_id = $1 AND id != $2 AND status = 'pending'`,
        [broadcastRow.order_id, broadcastId]
      );

      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (items && Array.isArray(items)) {
          for (const item of items) {
            const medicineName = item.medicine_name || item.name || item.product_name;
            const quantity = item.quantity;
            if (!medicineName) continue;
            await query(
              `UPDATE pharmacy_inventory 
               SET current_stock = current_stock - $1, updated_at = NOW()
               WHERE vendor_id = $2 AND (medicine_name = $3 OR medicine_id IN (SELECT id FROM medicines WHERE name = $3))
               AND is_active = true AND current_stock >= $1
               RETURNING id`,
              [quantity, pharmacyId, medicineName]
            );
          }
        }
      } catch (invErr) {
        console.warn('Inventory deduction failed:', invErr);
      }

      await websocketService.sendOrderStatusUpdate(
        broadcastRow.order_id,
        'pharmacy',
        'accepted',
        { pharmacyId }
      );
      await sendEventNotification({
        eventType: 'pharmacy_order_accepted',
        recipientId: order.customer_id,
        recipientType: 'customer',
        relatedId: broadcastRow.order_id,
        data: { pharmacyId },
      });

      return c.json({
        success: true,
        message: 'Order accepted',
        orderId: broadcastRow.order_id,
      });
    } catch (error: any) {
      console.error('Error accepting pharmacy order:', error);
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
   * Generate proforma invoice (pharmacy updates items/prices; customer sees invoice + delivery + platform + convenience)
   */
  app.post("/pharmacy/orders/:orderId/invoice", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const invoiceItems = body.invoiceItems ?? body.items;

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];
      let rawItems = invoiceItems || (typeof order.items === 'string' ? JSON.parse(order.items) : order.items);
      if (!Array.isArray(rawItems)) rawItems = [];

      const items = rawItems.map((item: any) => ({
        ...item,
        name: item.name ?? item.medicine_name ?? item.product_name,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price ?? item.price ?? 0) || 0,
      }));

      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const deliveryFee = parseFloat(order.delivery_fee) || 0;
      const platformFee = parseFloat(order.platform_fee) || 0;
      const convenienceFee = parseFloat(order.convenience_fee || '0') || 0;
      const totalAmount = subtotal + deliveryFee + platformFee + convenienceFee;

      await update('pharmacy_orders', { id: orderId }, {
        items: JSON.stringify(items),
        subtotal,
        total_amount: totalAmount,
        status: 'invoice_generated',
      });

      await websocketService.sendOrderStatusUpdate(orderId, 'pharmacy', 'invoice_generated', {});
      await sendEventNotification({
        eventType: 'pharmacy_order_invoice',
        recipientId: order.customer_id,
        recipientType: 'customer',
        relatedId: orderId,
        data: { totalAmount },
      });

      return c.json({
        success: true,
        invoice: {
          orderId,
          orderNumber: order.order_number,
          items,
          subtotal,
          deliveryFee,
          platformFee,
          convenienceFee,
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
      const currentRadius = order.current_broadcast_radius_km ?? 5;
      const steps = await getRuleNumberArray('pharmacy', 'broadcast_radius_km_steps', 'pharmacy_broadcast');
      const idx = steps.indexOf(currentRadius);
      let newRadius: number;
      if (idx >= 0 && idx < steps.length - 1) {
        newRadius = steps[idx + 1];
      } else {
        // Max radius reached, cancel order
        const maxKm = steps.length > 0 ? steps[steps.length - 1] : 20;
        await update('pharmacy_orders', { id: orderId }, {
          status: 'cancelled',
          cancellation_reason: `No pharmacy accepted within ${maxKm}km radius`,
          cancelled_at: new Date().toISOString(),
        });
        return c.json({
          success: false,
          message: `No pharmacy found within ${maxKm}km. Order cancelled.`,
        });
      }

      // Get current expansion count
      const currentExpansionCount = order.expansion_count || 0;

      // Update order radius with expansion tracking
      await update('pharmacy_orders', { id: orderId }, {
        current_broadcast_radius_km: newRadius,
        broadcast_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 more minutes
        last_expanded_at: new Date().toISOString(),
        expansion_count: currentExpansionCount + 1,
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
          po.order_number,
          po.customer_id,
          po.prescription_id,
          po.prescription_url,
          po.items,
          po.subtotal,
          po.delivery_fee,
          po.platform_fee,
          po.convenience_fee,
          po.total_amount,
          po.delivery_address,
          po.customer_lat,
          po.customer_lng,
          po.payment_method,
          po.status,
          po.notes,
          po.broadcast_expires_at,
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

      const orders = result.rows.map((row: any) => {
        const expiresAt = row.broadcast_expires_at ? new Date(row.broadcast_expires_at).getTime() : null;
        const expiresIn = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 600;
        return {
          ...row,
          items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
          delivery_address: typeof row.delivery_address === 'string' ? JSON.parse(row.delivery_address) : row.delivery_address,
          expiresIn,
        };
      });

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
   * 
   * Status Flow:
   * 1. broadcasting -> Order created, searching for pharmacy
   * 2. accepted -> Pharmacy accepted the order
   * 3. invoice_generated -> Pharmacy generated invoice
   * 4. payment_confirmed -> Customer paid
   * 5. preparing -> Pharmacy preparing order
   * 6. dispatched -> Order dispatched for delivery
   * 7. delivered -> Order delivered
   * 
   * Note: If status filter includes post-acceptance statuses (invoice_generated, payment_confirmed, etc.),
   * we automatically include 'accepted' to ensure newly accepted orders are visible.
   */
  app.get("/pharmacy/:vendorId/orders", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const statusFilter = c.req.query('status');

      // Build base query to fetch orders with customer and delivery tracking info
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

      // Process status filter if provided
      if (statusFilter) {
        // Parse comma-separated status values
        const requestedStatuses = statusFilter.split(',').map(s => s.trim()).filter(Boolean);

        // Statuses that come after 'accepted' in the order lifecycle
        const postAcceptanceStatuses = [
          'invoice_generated',
          'payment_confirmed',
          'preparing',
          'dispatched',
          'ready_for_pickup',
          'picked_up',
          'on_the_way',
          'delivered'
        ];

        // If any requested status comes after 'accepted', automatically include 'accepted'
        // This ensures newly accepted orders are visible even if frontend doesn't explicitly request 'accepted'
        const includesPostAcceptanceStatus = requestedStatuses.some(status =>
          postAcceptanceStatuses.includes(status.toLowerCase())
        );

        // Build final status list
        const finalStatuses = [...requestedStatuses];
        if (includesPostAcceptanceStatus && !finalStatuses.includes('accepted')) {
          finalStatuses.push('accepted');
        }

        // Apply status filter to query
        queryStr += ` AND po.status = ANY($2::text[])`;
        params.push(finalStatuses);
      }

      // Order by creation date (most recent first)
      queryStr += ` ORDER BY po.created_at DESC`;

      // Execute query
      const result = await query(queryStr, params);

      // Parse JSON fields and format response
      const orders = result.rows.map((row: any) => ({
        ...row,
        items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
        delivery_address: typeof row.delivery_address === 'string'
          ? JSON.parse(row.delivery_address)
          : row.delivery_address,
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

  // Debug endpoint to test pharmacy query
  app.get("/pharmacy/debug/nearby-pharmacies", async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '19.0954');
      const lng = parseFloat(c.req.query('lng') || '72.8331');
      const radiusKm = parseFloat(c.req.query('radius') || '5');

      const latDiff = radiusKm / 111;
      const lngDiff = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

      // First get all pharmacies with coordinates
      const allPharmacies = await query(
        `SELECT v.id, v.business_name, v.latitude, v.longitude, v.is_active, v.status, r.name as role_name
         FROM vendors v
         LEFT JOIN roles r ON v.role_id = r.id
         WHERE v.latitude IS NOT NULL 
         AND v.latitude::text != ''
         AND v.longitude IS NOT NULL
         AND v.longitude::text != ''
         LIMIT 10`,
        []
      );

      // Filter by role name
      const pharmacyVendors = await query(
        `SELECT v.id, v.business_name, v.latitude, v.longitude, v.is_active, v.status
         FROM vendors v
         WHERE v.role_id IN (SELECT id FROM roles WHERE LOWER(name) LIKE '%pharmacy%')
         AND v.is_active = true
         AND v.status = 'approved'
         AND v.latitude IS NOT NULL 
         AND v.latitude::text != ''
         AND v.longitude IS NOT NULL
         AND v.longitude::text != ''`,
        []
      );

      return c.json({
        success: true,
        debug: {
          searchLocation: { lat, lng },
          boundingBox: {
            latMin: lat - latDiff,
            latMax: lat + latDiff,
            lngMin: lng - lngDiff,
            lngMax: lng + lngDiff,
          },
          allVendorsWithCoordinates: allPharmacies.rows,
          pharmacyVendors: pharmacyVendors.rows,
        }
      });
    } catch (error: any) {
      return c.json({ error: error.message, stack: error.stack }, 500);
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

    console.log(`🔍 Searching for pharmacies near (${customerLat}, ${customerLng}) within ${radiusKm}km`);
    console.log(`📦 Bounding box: lat ${customerLat - latDiff} to ${customerLat + latDiff}, lng ${customerLng - lngDiff} to ${customerLng + lngDiff}`);

    // ✅ FIX: Query all approved pharmacies first, then filter by coordinates
    // Use simpler query without JOIN to avoid potential issues
    const pharmacies = await query(
      `SELECT v.id, v.business_name, v.phone, v.address, 
              v.latitude as lat_str, 
              v.longitude as lng_str,
              v.role_id
       FROM vendors v
       WHERE v.role_id IN (
         SELECT id FROM roles WHERE LOWER(name) LIKE '%pharmacy%'
       )
       AND v.is_active = true
       AND v.status = 'approved'
       AND v.latitude IS NOT NULL 
       AND v.latitude::text != ''
       AND v.longitude IS NOT NULL
       AND v.longitude::text != ''`,
      []
    );

    console.log(`📍 Found ${pharmacies.rows.length} pharmacies with coordinates`);

    // Filter by bounding box in JavaScript (more reliable than SQL CAST)
    const nearbyPharmacies = pharmacies.rows.filter((p: any) => {
      const lat = parseFloat(p.lat_str);
      const lng = parseFloat(p.lng_str);
      if (isNaN(lat) || isNaN(lng)) return false;

      return lat >= (customerLat - latDiff) && lat <= (customerLat + latDiff) &&
        lng >= (customerLng - lngDiff) && lng <= (customerLng + lngDiff);
    }).map((p: any) => ({
      ...p,
      lat: parseFloat(p.lat_str),
      lng: parseFloat(p.lng_str),
    }));

    console.log(`📍 ${nearbyPharmacies.length} pharmacies within bounding box`);

    // Filter by actual distance and create broadcasts
    let broadcastCount = 0;
    for (const pharmacy of nearbyPharmacies) {
      if (!pharmacy.lat || !pharmacy.lng) {
        console.log(`⚠️ Skipping ${pharmacy.business_name} - no coordinates`);
        continue;
      }

      const distance = calculateDistance(customerLat, customerLng, pharmacy.lat, pharmacy.lng);
      console.log(`📏 Distance to ${pharmacy.business_name}: ${distance.toFixed(2)}km (limit: ${radiusKm}km)`);

      if (distance <= radiusKm) {
        // Check if already broadcasted
        const existing = await query(
          `SELECT id FROM pharmacy_broadcasts WHERE order_id = $1 AND pharmacy_id = $2`,
          [orderId, pharmacy.id]
        );

        if (existing.rows.length === 0) {
          try {
            // Insert into pharmacy_broadcasts table (matching schema from migration 200)
            await insert('pharmacy_broadcasts', {
              order_id: orderId,
              pharmacy_id: pharmacy.id,
              radius_km: radiusKm,
              distance_from_customer: Math.round(distance * 100) / 100,
              status: 'pending',
              broadcast_time: new Date().toISOString(),
            });
            broadcastCount++;
            console.log(`📤 Broadcasted to ${pharmacy.business_name} (${distance.toFixed(2)}km)`);

            // ✅ FIX GAP PH-1: Send push notification to pharmacy
            try {
              const { pushNotificationService } = await import('../../../aws/aws-sns-notification-service');

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
          } catch (insertError) {
            console.error(`❌ Failed to insert broadcast for ${pharmacy.business_name}:`, insertError);
          }
        }
      }
    }

    console.log(`✅ Total broadcasts created: ${broadcastCount}`);
    return broadcastCount;
  } catch (error) {
    console.error('Error broadcasting to pharmacies:', error);
    return 0;
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

    // ✅ FIX: Get vendor with tier-based commission from vendor_tiers table
    // Priority: 1. vendor_tiers commission_rate, 2. Vendor custom rate, 3. Default 15%
    const vendors = await query(
      `SELECT v.*, 
              v.commission_rate as vendor_commission_rate,
              vt.commission_rate as tier_commission_rate,
              vt.tier_name
       FROM vendors v 
       LEFT JOIN vendor_tiers vt ON vt.is_active = true 
         AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
       WHERE v.id = $1`,
      [vendorId]
    );

    const vendor = vendors.rows[0];

    // Determine commission rate based on tier
    let commissionRate: number;

    if (vendor?.tier_commission_rate != null && !isNaN(Number(vendor.tier_commission_rate))) {
      // Use tier's commission rate from vendor_tiers
      commissionRate = Number(vendor.tier_commission_rate);
    } else if (vendor?.vendor_commission_rate != null && !isNaN(Number(vendor.vendor_commission_rate))) {
      // Use vendor's custom commission rate
      commissionRate = Number(vendor.vendor_commission_rate);
    } else {
      // Fallback to platform default
      console.warn(`⚠️ [PHARMACY-ORDERS] No tier found for vendor ${vendorId}, using default 15%`);
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

    const { pushNotificationService } = await import('../../../aws/aws-sns-notification-service');

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

/**
 * ✅ FIX: Additional pharmacy endpoints - moved outside helper function
 */
export function registerAdditionalPharmacyEndpoints(app: Hono) {
  /**
   * POST /pharmacy/orders/:orderId/invoice
   * Upload perfora invoice (S3 upload)
   */
  app.post("/pharmacy/orders/:orderId/invoice", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { invoiceUrl, invoiceAmount, items } = body;

      if (!invoiceUrl) {
        return c.json({ error: 'invoiceUrl is required' }, 400);
      }

      // Update order with invoice
      await update('pharmacy_orders', { id: orderId }, {
        perfora_invoice_url: invoiceUrl,
        invoice_amount: invoiceAmount || null,
        invoice_items: items ? JSON.stringify(items) : null,
        invoice_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Notify customer about invoice
      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length > 0) {
        await sendOrderStatusNotification(orderId, 'invoice_uploaded', {
          invoiceUrl,
          invoiceAmount,
        });
      }

      return c.json({
        success: true,
        message: 'Invoice uploaded successfully',
      });
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/assign-logistics
   * Assign logistics partner to order
   */
  app.post("/pharmacy/orders/:orderId/assign-logistics", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { logisticsPartnerId, logisticsPartnerType } = body;

      if (!logisticsPartnerId || !logisticsPartnerType) {
        return c.json({ error: 'logisticsPartnerId and logisticsPartnerType are required' }, 400);
      }

      // Update order with logistics partner
      await update('pharmacy_orders', { id: orderId }, {
        logistics_partner_id: logisticsPartnerId,
        logistics_type: logisticsPartnerType,
        logistics_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Notify customer
      await sendOrderStatusNotification(orderId, 'logistics_assigned', {
        logisticsPartnerId,
        logisticsPartnerType,
      });

      return c.json({
        success: true,
        message: 'Logistics partner assigned',
      });
    } catch (error: any) {
      console.error('Error assigning logistics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/:orderId/tracking
   * Get order tracking information
   */
  app.get("/pharmacy/orders/:orderId/tracking", async (c) => {
    try {
      const { orderId } = c.req.param();

      // Get order
      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Get tracking if exists
      const trackingResult = await query(
        `SELECT * FROM delivery_tracking WHERE pharmacy_order_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      const tracking = trackingResult.rows[0] || null;

      return c.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          trackingStatus: tracking?.status || null,
        },
        tracking: tracking ? {
          id: tracking.id,
          status: tracking.status,
          currentLocation: tracking.current_lat && tracking.current_lng ? {
            lat: parseFloat(tracking.current_lat),
            lng: parseFloat(tracking.current_lng),
          } : null,
          eta: tracking.eta_to_delivery_minutes,
          deliveryPerson: tracking.delivery_person_name ? {
            name: tracking.delivery_person_name,
            phone: tracking.delivery_person_phone,
            photo: tracking.delivery_person_photo,
          } : null,
        } : null,
      });
    } catch (error: any) {
      console.error('Error getting tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/:orderId/broadcast-status
   * Get broadcast status (radius, expanded status)
   */
  app.get("/pharmacy/orders/:orderId/broadcast-status", async (c) => {
    try {
      const { orderId } = c.req.param();

      const broadcasts = await query(
        `SELECT pb.*, v.business_name as pharmacy_name, v.phone as pharmacy_phone,
                v.latitude as pharmacy_latitude, v.longitude as pharmacy_longitude
         FROM pharmacy_broadcasts pb
         LEFT JOIN vendors v ON pb.pharmacy_id = v.id
         WHERE pb.order_id = $1
         ORDER BY pb.created_at DESC`,
        [orderId]
      );

      const order = await select('pharmacy_orders', { id: orderId });
      const currentRadius = order[0]?.current_broadcast_radius_km ?? order[0]?.broadcast_radius ?? 5;

      return c.json({
        success: true,
        broadcastStatus: {
          currentRadius,
          expandedAt: order[0]?.last_expanded_at ?? order[0]?.broadcast_expanded_at ?? null,
          totalBroadcasts: broadcasts.rows.length,
          accepted: broadcasts.rows.filter((b: any) => b.status === 'accepted').length,
          pending: broadcasts.rows.filter((b: any) => b.status === 'pending').length,
          rejected: broadcasts.rows.filter((b: any) => b.status === 'rejected').length,
        },
        broadcasts: broadcasts.rows.map((b: any) => ({
          id: b.id,
          pharmacyId: b.pharmacy_id,
          pharmacyName: b.pharmacy_name,
          pharmacy_phone: b.pharmacy_phone,
          pharmacyPhone: b.pharmacy_phone,
          status: b.status,
          respondedAt: b.response_time,
          response_time: b.response_time,
          distance_from_customer: b.distance_from_customer,
          distanceFromCustomer: b.distance_from_customer,
          latitude: b.pharmacy_latitude != null ? parseFloat(b.pharmacy_latitude) : null,
          longitude: b.pharmacy_longitude != null ? parseFloat(b.pharmacy_longitude) : null,
        })),
      });
    } catch (error: any) {
      console.error('Error getting broadcast status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/:orderId/pharmacy-status
   * Public order status (same shape as /customer/orders/:orderId/pharmacy-status).
   * Used for contract tests and track-by-order-id without customer auth.
   */
  app.get("/pharmacy/orders/:orderId/pharmacy-status", async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const { rows: orders } = await query(`
        SELECT 
          po.*,
          v.business_name as pharmacy_name,
          v.phone as pharmacy_phone,
          v.address as pharmacy_address,
          dt.delivery_otp as dt_delivery_otp,
          dt.otp_verified as dt_otp_verified,
          dt.delivery_person_name as dt_partner_name,
          dt.delivery_person_phone as dt_partner_phone
        FROM pharmacy_orders po
        LEFT JOIN vendors v ON v.id = po.pharmacy_id
        LEFT JOIN delivery_tracking dt ON dt.pharmacy_order_id = po.id
        WHERE po.id = $1
      `, [orderId]);

      if (orders.length === 0) {
        const { rows: regularOrders } = await query(
          `SELECT * FROM orders WHERE id = $1`,
          [orderId]
        );
        if (regularOrders.length === 0) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }
        const order = regularOrders[0];
        return c.json({
          success: true,
          order: {
            id: order.id,
            status: order.status,
            medicines: typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []),
            totalAmount: order.total_amount,
          }
        });
      }

      const order = orders[0];
      const items = (() => {
        try {
          const arr = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
          return arr.map((item: any) => ({
            name: item.medicine_name || item.name,
            quantity: item.quantity,
            price: item.unit_price ?? item.price,
            available: item.available !== false,
          }));
        } catch { return []; }
      })();

      return c.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          pharmacyId: order.pharmacy_id,
          pharmacyName: order.pharmacy_name,
          pharmacyPhone: order.pharmacy_phone,
          pharmacyAddress: order.pharmacy_address,
          estimatedTime: order.estimated_delivery_minutes,
          broadcastTime: order.broadcast_started_at,
          acceptedTime: order.accepted_at,
          medicines: items,
          subtotal: order.subtotal,
          deliveryFee: order.delivery_fee,
          platformFee: order.platform_fee,
          convenienceFee: order.convenience_fee,
          totalAmount: order.total_amount,
          total_amount: order.total_amount,
          proformaInvoice: order.proforma_invoice_id ? {
            id: order.proforma_invoice_id,
            total: order.invoice_amount,
            items,
          } : undefined,
          deliveryOtp: order.dt_delivery_otp ?? order.delivery_otp,
          otpVerified: order.dt_otp_verified ?? order.otp_verified,
          deliveryPartnerName: order.dt_partner_name ?? order.partner_name,
          deliveryPartnerPhone: order.dt_partner_phone ?? order.partner_phone,
          deliveryAddress: (() => {
            try {
              return typeof order.delivery_address === 'string'
                ? JSON.parse(order.delivery_address)
                : order.delivery_address;
            } catch { return order.delivery_address; }
          })(),
          currentRadius: order.current_broadcast_radius || 5,
          maxRadius: order.max_broadcast_radius || 20,
          broadcastStartedAt: order.broadcast_started_at,
        }
      });
    } catch (error: any) {
      console.error('Error getting pharmacy order status:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * POST /customer/pharmacy/orders/:orderId/approve-invoice
   * Customer approves the pharmacy's proforma invoice
   */
  app.post("/customer/pharmacy/orders/:orderId/approve-invoice", async (c) => {
    try {
      const { orderId } = c.req.param();

      // Validate orderId parameter
      const orderIdValidation = uuidSchema.safeParse(orderId);
      if (!orderIdValidation.success) {
        return c.json({ error: 'Invalid order ID format' }, 400);
      }

      // Validate request body using Zod schema
      const body = await c.req.json();
      const validationResult = approveInvoiceRequestSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json({
          error: 'Invalid request body',
          details: validationResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        }, 400);
      }

      const { approved, phone } = validationResult.data;

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Verify customer owns this order (by phone)
      if (phone) {
        const customers = await select('customers', { id: order.customer_id });
        if (customers.length > 0 && customers[0].phone !== phone) {
          return c.json({ error: 'Unauthorized' }, 403);
        }
      }

      if (!approved) {
        // Customer rejected the invoice - cancel the order
        await update('pharmacy_orders', { id: orderId }, {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Customer rejected invoice',
          updated_at: new Date().toISOString(),
        });

        // Notify pharmacy about cancellation
        try {
          const { sendEventNotification } = await import('../../../aws/aws-sns-notification-service');
          await sendEventNotification({
            userId: order.pharmacy_id,
            userType: 'vendor',
            eventType: 'order_cancelled',
            title: 'Order Cancelled',
            body: 'Customer rejected the invoice and cancelled the order.',
            data: { orderId, reason: 'invoice_rejected' },
          });
        } catch (notifErr) {
          console.warn('[INVOICE] Failed to send cancellation notification:', notifErr);
        }

        return c.json({
          success: true,
          status: 'cancelled',
          message: 'Order cancelled - invoice was rejected',
        });
      }

      // Customer approved the invoice - update status
      await update('pharmacy_orders', { id: orderId }, {
        status: 'invoice_approved',
        invoice_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Notify pharmacy that customer approved
      try {
        const { sendEventNotification } = await import('../../../aws/aws-sns-notification-service');
        await sendEventNotification({
          userId: order.pharmacy_id,
          userType: 'vendor',
          eventType: 'invoice_approved',
          title: 'Invoice Approved! 🎉',
          body: 'Customer has approved the invoice. Awaiting payment.',
          data: { orderId },
        });
      } catch (notifErr) {
        console.warn('[INVOICE] Failed to send approval notification:', notifErr);
      }

      return c.json({
        success: true,
        status: 'invoice_approved',
        message: 'Invoice approved successfully. Please proceed to payment.',
        order: {
          id: orderId,
          status: 'invoice_approved',
          totalAmount: parseFloat(order.total_amount),
        },
      });
    } catch (error: any) {
      console.error('Error approving invoice:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/pharmacy/orders/:orderId/status
   * Get pharmacy order status for customer
   */
  app.get("/customer/pharmacy/orders/:orderId/status", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await query(
        `SELECT po.*, 
                v.business_name as pharmacy_name,
                v.phone as pharmacy_phone,
                v.address as pharmacy_address
         FROM pharmacy_orders po
         LEFT JOIN vendors v ON po.pharmacy_id = v.id
         WHERE po.id = $1`,
        [orderId]
      );

      // Get delivery tracking separately to handle missing columns
      let deliveryInfo: any = {};
      try {
        const tracking = await query(
          `SELECT * FROM delivery_tracking WHERE pharmacy_order_id = $1 LIMIT 1`,
          [orderId]
        );
        if (tracking.rows.length > 0) {
          deliveryInfo = tracking.rows[0];
        }
      } catch (trackErr) {
        console.log('[ORDER STATUS] Delivery tracking not found or table missing');
      }

      if (orders.rows.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders.rows[0];

      // ✅ PAYMENT VERIFICATION: Check payment status with Razorpay
      let verifiedPaymentStatus = order.payment_status || 'pending';
      let paymentVerificationResult: any = null;

      // Only verify if payment method is online (not COD)
      if (order.payment_method && requiresPayment(order.payment_method)) {
        try {
          // Look up payment in payments table
          const paymentQuery = `
            SELECT p.*
            FROM payments p
            WHERE p.pharmacy_order_id = $1
               OR (p.customer_id = $2 AND p.pharmacy_order_id IS NULL)
          ORDER BY p.created_at DESC
          LIMIT 1
          `;
          const paymentResult = await query(paymentQuery, [orderId, order.customer_id]);

          if (paymentResult.rows.length > 0) {
            const payment = paymentResult.rows[0];
            const razorpayOrderId = payment.razorpay_order_id || order.razorpay_order_id;
            const razorpayPaymentId = payment.razorpay_payment_id || order.razorpay_payment_id;
            const totalAmount = parseFloat(order.total_amount || 0);

            // Verify payment with Razorpay if we have payment IDs
            if (razorpayOrderId || razorpayPaymentId) {
              const verification = await verifyPayment({
                customerId: order.customer_id,
                totalAmount,
                razorpayOrderId,
                razorpayPaymentId,
                paymentMethod: order.payment_method,
                pharmacyOrderId: orderId,
              });

              paymentVerificationResult = {
                verified: verification.verified,
                databaseVerified: verification.databaseVerified,
                razorpayVerified: verification.razorpayVerified,
                error: verification.error,
              };

              // Update payment status based on verification
              if (verification.verified) {
                verifiedPaymentStatus = 'paid';

                // Update pharmacy_orders table if payment is verified but DB shows pending
                if (order.payment_status !== 'paid') {
                  try {
                    await update('pharmacy_orders', { id: orderId }, {
                      payment_status: 'paid',
                      updated_at: new Date().toISOString(),
                    });
                    console.log(`[ORDER STATUS] Updated payment_status to 'paid' for order ${orderId}`);
                  } catch (updateErr: any) {
                    console.error('[ORDER STATUS] Failed to update payment_status:', updateErr);
                  }
                }
              } else {
                // Payment not verified - keep as pending
                verifiedPaymentStatus = 'pending';
              }
            } else {
              // No Razorpay IDs found - check database payment status
              if (payment.payment_status === 'completed') {
                verifiedPaymentStatus = 'paid';
              } else {
                verifiedPaymentStatus = payment.payment_status || 'pending';
              }
            }
          } else {
            // No payment record found - check order's payment status
            verifiedPaymentStatus = order.payment_status || 'pending';
          }
        } catch (paymentErr: any) {
          console.error('[ORDER STATUS] Payment verification error:', paymentErr);
          // Fall back to database payment status
          verifiedPaymentStatus = order.payment_status || 'pending';
        }
      } else {
        // COD order - no verification needed
        verifiedPaymentStatus = order.payment_status || 'pending';
      }

      // Get broadcast status if still broadcasting
      let broadcastStatus = null;
      if (order.status === 'broadcasting') {
        const broadcasts = await query(
          `SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
            MAX(radius_km) as current_radius
           FROM pharmacy_broadcasts 
           WHERE order_id = $1`,
          [orderId]
        );
        if (broadcasts.rows.length > 0) {
          broadcastStatus = {
            pending: parseInt(broadcasts.rows[0].pending),
            accepted: parseInt(broadcasts.rows[0].accepted),
            rejected: parseInt(broadcasts.rows[0].rejected),
            currentRadius: parseFloat(broadcasts.rows[0].current_radius) || order.current_broadcast_radius || 5,
          };
        }
      }

      return c.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
          subtotal: parseFloat(order.subtotal),
          deliveryFee: parseFloat(order.delivery_fee),
          platformFee: parseFloat(order.platform_fee),
          convenienceFee: parseFloat(order.convenience_fee || 0),
          taxAmount: parseFloat(order.tax_amount || 0),
          total: parseFloat(order.total_amount),
          pharmacyId: order.pharmacy_id,
          pharmacyName: order.pharmacy_name,
          pharmacyPhone: order.pharmacy_phone,
          pharmacyAddress: order.pharmacy_address,
          deliveryAddress: typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : order.delivery_address,
          invoiceUrl: order.perfora_invoice_url || order.invoice_url,
          invoiceAmount: parseFloat(order.invoice_amount || order.total_amount),
          paymentMethod: order.payment_method,
          paymentStatus: verifiedPaymentStatus, // ✅ Use verified payment status
          paymentVerification: paymentVerificationResult, // ✅ Include verification details
          deliveryOtp: deliveryInfo.delivery_otp || order.delivery_otp,
          deliveryStatus: deliveryInfo.status || order.delivery_status,
          deliveryPartnerName: deliveryInfo.partner_name || deliveryInfo.delivery_partner_name,
          deliveryPartnerPhone: deliveryInfo.partner_phone || deliveryInfo.delivery_partner_phone,
          estimatedDeliveryTime: deliveryInfo.estimated_delivery_time,
          currentRadius: order.current_broadcast_radius,
          broadcastStartedAt: order.broadcast_started_at,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
        },
        broadcastStatus,
      });
    } catch (error: any) {
      console.error('Error fetching order status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/payment
   * Process payment for pharmacy order
   */
  app.post("/pharmacy/orders/:orderId/payment", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { paymentMethod, paymentId, razorpayOrderId, razorpayPaymentId } = await c.req.json();

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Update order with payment info
      const updateData: any = {
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'completed',
        updated_at: new Date().toISOString(),
      };

      if (paymentId) updateData.payment_id = paymentId;
      if (razorpayOrderId) updateData.razorpay_order_id = razorpayOrderId;
      if (razorpayPaymentId) updateData.razorpay_payment_id = razorpayPaymentId;

      // Update status to confirmed/paid
      if (paymentMethod === 'online' && razorpayPaymentId) {
        updateData.status = 'paid';
        updateData.paid_at = new Date().toISOString();
      } else if (paymentMethod === 'cod') {
        updateData.status = 'confirmed';
      }

      await update('pharmacy_orders', { id: orderId }, updateData);

      return c.json({
        success: true,
        message: paymentMethod === 'cod' ? 'Order confirmed for COD' : 'Payment successful',
        order: {
          id: orderId,
          status: updateData.status,
          paymentStatus: updateData.payment_status,
        },
      });
    } catch (error: any) {
      console.error('Error processing payment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/confirm-cod
   * Confirm Cash on Delivery order
   */
  app.post("/pharmacy/orders/:orderId/confirm-cod", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { paymentMethod } = await c.req.json();

      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      await update('pharmacy_orders', { id: orderId }, {
        payment_method: 'cod',
        payment_status: 'pending',
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Order confirmed for Cash on Delivery',
        order: {
          id: orderId,
          status: 'confirmed',
          paymentMethod: 'cod',
        },
      });
    } catch (error: any) {
      console.error('Error confirming COD:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * ============================================================================
   * CUSTOMER-FACING PHARMACY ENDPOINTS
   * ============================================================================
   * These are convenience endpoints for the customer app that delegate to the
   * main pharmacy endpoints with adapted request/response formats.
   */

  /**
   * POST /customer/pharmacy/orders
   * Customer-facing endpoint to create pharmacy order from checkout
   * Adapts frontend request format to backend pharmacy order format
   */
  app.post("/customer/pharmacy/orders", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request body using Zod schema
      const validationResult = createPharmacyOrderRequestSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json({
          error: 'Invalid request body',
          details: validationResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        }, 400);
      }

      const {
        items,
        address,
        phone,
        subtotal,
        taxAmount,
        taxBreakdown,
        total,
        prescription_verified,
        prescriptionId,
        orderType,
        notes,
      } = validationResult.data;

      // Resolve customer ID from phone
      let customerId: string;
      try {
        const customers = await select('customers', { phone: phone });
        if (customers.length === 0) {
          // Create customer if not exists
          const newCustomer = await insert('customers', {
            phone: phone,
            full_name: address.name || 'Customer',
            created_at: new Date().toISOString(),
          });
          customerId = newCustomer[0]?.id || newCustomer.id;
        } else {
          customerId = customers[0].id;
        }
      } catch (error: any) {
        console.error('Error resolving customer:', error);
        return c.json({ error: 'Failed to resolve customer' }, 500);
      }

      // Transform items to pharmacy order format
      const pharmacyItems = items.map((item: any) => ({
        medicine_name: item.name || item.productId,
        product_id: item.productId || item.id,
        quantity: item.quantity,
        unit_price: item.price,
        prescription_required: item.prescription_required || false,
      }));

      // Transform address to delivery address format
      const deliveryAddress = {
        address: [
          address.addressLine1 || address.street,
          address.addressLine2,
          address.landmark,
          address.city,
          address.state,
          address.pincode
        ].filter(Boolean).join(', '),
        address_line1: address.addressLine1 || address.street,
        address_line2: address.addressLine2 || '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark || '',
        lat: address.latitude || address.lat || 0,
        lng: address.longitude || address.lng || 0,
        phone: address.phone || phone,
        name: address.name || 'Customer',
      };

      // Calculate fees
      const orderSubtotal = subtotal || pharmacyItems.reduce((sum: number, item: any) =>
        sum + (item.quantity * item.unit_price), 0
      );

      const estimatedDeliveryFee = await calculateDeliveryFee(5);
      const platformFee = await calculatePlatformFee(orderSubtotal, 'pharmacy');
      const convenienceFee = await getConvenienceFee('pharmacy');

      // Create order - use minimal required fields to ensure compatibility
      const totalAmount = total || (orderSubtotal + estimatedDeliveryFee + platformFee + convenienceFee + (taxAmount || 0));

      // Ensure pharmacy_orders table has all required columns
      try {
        await query(`
          ALTER TABLE pharmacy_orders 
          ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0;
        `);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS convenience_fee DECIMAL(10,2) DEFAULT 0;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS tax_breakdown JSONB;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10,6);`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(10,6);`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS prescription_verified BOOLEAN DEFAULT false;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS current_broadcast_radius INTEGER DEFAULT 5;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS max_broadcast_radius INTEGER DEFAULT 20;`);
        await query(`ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS broadcast_started_at TIMESTAMP WITH TIME ZONE;`);
        console.log('[PHARMACY ORDER] Schema columns verified/added');
      } catch (alterErr: any) {
        console.log('[PHARMACY ORDER] Schema alteration note:', alterErr.message);
      }

      const orderResult = await insert('pharmacy_orders', {
        customer_id: customerId,
        prescription_id: prescriptionId || null,
        items: JSON.stringify(pharmacyItems),
        subtotal: orderSubtotal,
        delivery_fee: estimatedDeliveryFee,
        platform_fee: platformFee,
        convenience_fee: convenienceFee,
        tax_amount: taxAmount || 0,
        tax_breakdown: taxBreakdown ? JSON.stringify(taxBreakdown) : null,
        total_amount: totalAmount,
        delivery_address: JSON.stringify(deliveryAddress),
        delivery_lat: deliveryAddress.lat,
        delivery_lng: deliveryAddress.lng,
        payment_method: 'online', // Default to online for pharmacy orders
        status: 'pending', // Start with pending, will broadcast to pharmacies
        prescription_verified: prescription_verified || false,
        notes: notes || null,
        current_broadcast_radius: 5,
        max_broadcast_radius: 20,
        broadcast_started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const orderId = orderResult[0]?.id || orderResult.id;

      console.log(`[PHARMACY ORDER] Created order ${orderId} for customer ${customerId}`);

      // ✅ FIX: Start pharmacy broadcast immediately
      if (deliveryAddress.lat && deliveryAddress.lng) {
        // Update status to broadcasting
        await update('pharmacy_orders', { id: orderId }, {
          status: 'broadcasting',
          broadcast_started_at: new Date().toISOString(),
        });

        // Broadcast to nearby pharmacies (first 5km radius)
        await broadcastToPharmacies(orderId, deliveryAddress.lat, deliveryAddress.lng, 5);
        console.log(`[PHARMACY ORDER] Started broadcast for order ${orderId} at 5km radius`);
      } else {
        console.warn(`[PHARMACY ORDER] No lat/lng for order ${orderId}, skipping broadcast`);
      }

      return c.json({
        success: true,
        orderId,
        order: {
          id: orderId,
          customerId,
          status: 'broadcasting',
          subtotal: orderSubtotal,
          deliveryFee: estimatedDeliveryFee,
          platformFee,
          convenienceFee,
          taxAmount: taxAmount || 0,
          total: total || (orderSubtotal + estimatedDeliveryFee + platformFee + convenienceFee + (taxAmount || 0)),
          currentRadius: 5,
          maxRadius: 20,
        },
        message: 'Order created. Broadcasting to nearby pharmacies...',
      });
    } catch (error: any) {
      console.error('Error creating customer pharmacy order:', error);
      return c.json({ error: error.message || 'Failed to create order' }, 500);
    }
  });

  /**
   * GET /customer/pharmacy/medicines
   * Customer catalog: aggregate medicines from vendors with pharmacy role (OTC / store)
   */
  app.get("/customer/pharmacy/medicines", async (c) => {
    try {
      const { rows } = await query(
        `SELECT p.id, p.name, p.description, p.category, p.subcategory, p.price, p.stock,
                p.images, p.vendor_id, p.created_at,
                (p.stock IS NULL OR p.stock > 0) AS in_stock,
                false AS prescription_required
         FROM products p
         INNER JOIN vendors v ON v.id = p.vendor_id
         INNER JOIN roles r ON r.id = v.role_id AND LOWER(r.name) IN ('pharmacy', 'pet_pharmacy')
         WHERE (p.category = 'medicine' OR p.category = 'pharmacy' OR p.category ILIKE '%medicine%')
         AND (v.is_active IS NOT FALSE)
         ORDER BY p.created_at DESC
         LIMIT 200`
      );
      const medicines = (rows || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        brand: row.subcategory,
        description: row.description,
        category: row.category,
        price: parseFloat(row.price) || 0,
        stock: row.stock != null ? Number(row.stock) : null,
        in_stock: row.in_stock !== false,
        prescription_required: row.prescription_required === true,
        image: Array.isArray(row.images) ? row.images[0] : row.images,
        images: row.images,
      }));
      return c.json({ success: true, medicines, products: medicines });
    } catch (error: any) {
      console.error('Error fetching customer pharmacy medicines:', error);
      return c.json({ success: true, medicines: [], products: [] });
    }
  });

  /**
   * GET /customer/pharmacy/orders
   * Get pharmacy orders for a customer by phone
   */
  app.get("/customer/pharmacy/orders", async (c) => {
    try {
      const phone = c.req.query('phone');
      console.log('phone', phone);
      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      // Resolve customer ID from phone
      const customers = await select('customers', { phone: phone });
      if (customers.length === 0) {
        return c.json({ success: true, orders: [] });
      }

      const customerId = customers[0].id;

      // Get orders - exclude broadcasting and orders without invoice (only include orders with invoice generated)
      const orders = await query(
        `SELECT po.*, 
                v.business_name as pharmacy_name,
                v.phone as pharmacy_phone
         FROM pharmacy_orders po
         LEFT JOIN vendors v ON po.pharmacy_id = v.id
         WHERE po.customer_id = $1
           AND po.status IN ('invoice_generated', 'invoice_sent', 'payment_confirmed', 'preparing', 'dispatched', 'on_the_way', 'delivered')
         ORDER BY po.created_at DESC
         LIMIT 50`,
        [customerId]
      );

      //Verify payment status for each order
      const ordersWithPaymentStatus = await Promise.all(
        orders.rows.map(async (order: any) => {
          let verifiedPaymentStatus = order.payment_status || 'pending';
          let paymentVerificationResult: any = null;

          // Only verify if payment method is online (not COD)
          if (order.payment_method && requiresPayment(order.payment_method)) {
            try {
              // Look up payment in payments table
              const paymentQuery = `
                SELECT p.*
                FROM payments p
                WHERE p.pharmacy_order_id = $1
                   OR (p.customer_id = $2 AND p.pharmacy_order_id IS NULL)
                ORDER BY p.created_at DESC
                LIMIT 1
              `;
              const paymentResult = await query(paymentQuery, [order.id, customerId]);

              if (paymentResult.rows.length > 0) {
                const payment = paymentResult.rows[0];
                const razorpayOrderId = payment.razorpay_order_id || order.razorpay_order_id;
                const razorpayPaymentId = payment.razorpay_payment_id || order.razorpay_payment_id;
                const totalAmount = parseFloat(order.total_amount || 0);

                // Verify payment with Razorpay if we have payment IDs
                if (razorpayOrderId || razorpayPaymentId) {
                  const verification = await verifyPayment({
                    customerId,
                    totalAmount,
                    razorpayOrderId,
                    razorpayPaymentId,
                    paymentMethod: order.payment_method,
                    pharmacyOrderId: order.id,
                  });

                  paymentVerificationResult = {
                    verified: verification.verified,
                    databaseVerified: verification.databaseVerified,
                    razorpayVerified: verification.razorpayVerified,
                    error: verification.error,
                  };

                  // Update payment status based on verification
                  if (verification.verified) {
                    verifiedPaymentStatus = 'paid';

                    // Update pharmacy_orders table if payment is verified but DB shows pending
                    if (order.payment_status !== 'paid') {
                      try {
                        await update('pharmacy_orders', { id: order.id }, {
                          payment_status: 'paid',
                          updated_at: new Date().toISOString(),
                        });
                        console.log(`[CUSTOMER ORDERS] Updated payment_status to 'paid' for order ${order.id}`);
                      } catch (updateErr: any) {
                        console.error('[CUSTOMER ORDERS] Failed to update payment_status:', updateErr);
                      }
                    }
                  } else {
                    // Payment not verified - keep as pending
                    verifiedPaymentStatus = 'pending';
                  }
                } else {
                  // No Razorpay IDs found - check database payment status
                  if (payment.payment_status === 'completed') {
                    verifiedPaymentStatus = 'paid';
                  } else {
                    verifiedPaymentStatus = payment.payment_status || 'pending';
                  }
                }
              } else {
                // No payment record found - check order's payment status
                verifiedPaymentStatus = order.payment_status || 'pending';
              }
            } catch (paymentErr: any) {
              console.error(`[CUSTOMER ORDERS] Payment verification error for order ${order.id}:`, paymentErr);
              // Fall back to database payment status
              verifiedPaymentStatus = order.payment_status || 'pending';
            }
          } else {
            // COD order - no verification needed
            verifiedPaymentStatus = order.payment_status || 'pending';
          }

          // Determine display status: if payment is paid, show 'payment_confirmed', otherwise show actual status
          const displayStatus = verifiedPaymentStatus === 'paid' ? 'payment_confirmed' : order.status;

          return {
            id: order.id,
            order_number: order.order_number,
            status: displayStatus, // ✅ Show 'payment_confirmed' if paid, otherwise actual status
            items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
            subtotal: parseFloat(order.subtotal || 0),
            deliveryFee: parseFloat(order.delivery_fee || 0),
            platformFee: parseFloat(order.platform_fee || 0),
            convenienceFee: parseFloat(order.convenience_fee || 0),
            taxAmount: parseFloat(order.tax_amount || 0),
            total: parseFloat(order.total_amount || 0),
            pharmacyName: order.pharmacy_name,
            pharmacyPhone: order.pharmacy_phone,
            deliveryAddress: typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : order.delivery_address,
            paymentMethod: order.payment_method,
            paymentStatus: verifiedPaymentStatus, // ✅ Use verified payment status
            paymentVerification: paymentVerificationResult, // ✅ Include verification details
            createdAt: order.created_at,
            updatedAt: order.updated_at,
          };
        })
      );

      return c.json({
        success: true,
        orders: ordersWithPaymentStatus,
      });
    } catch (error: any) {
      console.error('Error fetching customer pharmacy orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
