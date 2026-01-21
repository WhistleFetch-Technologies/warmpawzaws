/**
 * ============================================================================
 * DELIVERY TRACKING ENDPOINTS
 * ============================================================================
 * 
 * Features:
 * - Assign delivery partner to order
 * - Update delivery status
 * - Track live location (GPS updates)
 * - Customer tracking view
 * - Delivery partner dashboard
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerDeliveryTrackingEndpoints(app: Hono) {

  // ============================================================================
  // DELIVERY PARTNER ASSIGNMENT
  // ============================================================================

  /**
   * POST /delivery/assign
   * Assign a delivery partner to an order
   */
  app.post("/delivery/assign", async (c) => {
    try {
      const {
        pharmacyOrderId,
        mealOrderId,
        deliveryPartnerId,
        deliveryPersonName,
        deliveryPersonPhone,
        deliveryPersonPhoto,
        vehicleNumber,
      } = await c.req.json();

      // Validate - need exactly one order type
      if ((!pharmacyOrderId && !mealOrderId) || (pharmacyOrderId && mealOrderId)) {
        return c.json({ error: 'Provide either pharmacyOrderId or mealOrderId, not both' }, 400);
      }

      // Generate 4-digit OTP for delivery verification
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Create tracking record
      const tracking = await insert('delivery_tracking', {
        pharmacy_order_id: pharmacyOrderId || null,
        meal_order_id: mealOrderId || null,
        logistics_partner_id: deliveryPartnerId,
        delivery_person_name: deliveryPersonName,
        delivery_person_phone: deliveryPersonPhone,
        delivery_person_photo: deliveryPersonPhoto,
        vehicle_number: vehicleNumber,
        status: 'assigned',
        delivery_otp: deliveryOtp,
        assigned_at: new Date().toISOString(),
      });

      // Update order status
      if (pharmacyOrderId) {
        await update('pharmacy_orders', { id: pharmacyOrderId }, {
          logistics_partner_id: deliveryPartnerId,
          status: 'ready_for_pickup',
        });
      } else if (mealOrderId) {
        await update('meal_orders', { id: mealOrderId }, {
          logistics_partner_id: deliveryPartnerId,
          status: 'ready_for_pickup',
        });
      }

      return c.json({
        success: true,
        tracking: tracking[0],
        deliveryOtp,
        message: 'Delivery partner assigned',
      });
    } catch (error: any) {
      console.error('Error assigning delivery partner:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /delivery/:trackingId/update-status
   * Update delivery status
   */
  app.post("/delivery/:trackingId/update-status", async (c) => {
    try {
      const { trackingId } = c.req.param();
      const { status, notes } = await c.req.json();

      const validStatuses = [
        'assigned', 'heading_to_pickup', 'at_pickup', 
        'picked_up', 'on_the_way', 'nearby', 'delivered', 'failed'
      ];

      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const updateData: Record<string, any> = { status };

      if (status === 'at_pickup') updateData.reached_pickup_at = new Date().toISOString();
      if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString();
      if (status === 'delivered') updateData.delivered_at = new Date().toISOString();

      await update('delivery_tracking', { id: trackingId }, updateData);

      // Get tracking to update order
      const trackings = await select('delivery_tracking', { id: trackingId });
      if (trackings.length > 0) {
        const tracking = trackings[0];
        
        // Update order status
        if (tracking.pharmacy_order_id) {
          await update('pharmacy_orders', { id: tracking.pharmacy_order_id }, { status });
        } else if (tracking.meal_order_id) {
          await update('meal_orders', { id: tracking.meal_order_id }, { status });
        }
      }

      return c.json({
        success: true,
        message: `Status updated to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /delivery/:trackingId/update-location
   * Update delivery partner's live location
   */
  app.post("/delivery/:trackingId/update-location", async (c) => {
    try {
      const { trackingId } = c.req.param();
      const { lat, lng, accuracy, speed, heading, etaMinutes, distanceRemaining } = await c.req.json();

      // Update current location in tracking
      await update('delivery_tracking', { id: trackingId }, {
        current_lat: lat,
        current_lng: lng,
        last_location_update: new Date().toISOString(),
        eta_to_delivery_minutes: etaMinutes,
        distance_remaining_km: distanceRemaining,
      });

      // Add to location history
      await insert('delivery_location_history', {
        tracking_id: trackingId,
        lat,
        lng,
        accuracy_meters: accuracy,
        speed_kmh: speed,
        heading,
      });

      return c.json({
        success: true,
        message: 'Location updated',
      });
    } catch (error: any) {
      console.error('Error updating location:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /delivery/:trackingId/verify-otp
   * Verify OTP for delivery completion
   */
  app.post("/delivery/:trackingId/verify-otp", async (c) => {
    try {
      const { trackingId } = c.req.param();
      const { otp, deliveryPhoto, recipientName, notes } = await c.req.json();

      // Get tracking
      const trackings = await select('delivery_tracking', { id: trackingId });
      if (trackings.length === 0) {
        return c.json({ error: 'Tracking not found' }, 404);
      }

      const tracking = trackings[0];

      // Verify OTP
      if (tracking.delivery_otp !== otp) {
        return c.json({ error: 'Invalid OTP', code: 'INVALID_OTP' }, 400);
      }

      // Update tracking
      await update('delivery_tracking', { id: trackingId }, {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivery_photo: deliveryPhoto,
        recipient_name: recipientName,
        delivery_notes: notes,
        otp_verified: true,
      });

      // Update order status and trigger settlement
      if (tracking.pharmacy_order_id) {
        await update('pharmacy_orders', { id: tracking.pharmacy_order_id }, {
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        });
        // Settlement will be triggered by order completion
      } else if (tracking.meal_order_id) {
        await update('meal_orders', { id: tracking.meal_order_id }, {
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Delivery completed successfully',
      });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /delivery/tracking/:trackingId
   * Get tracking details (for customer view)
   */
  app.get("/delivery/tracking/:trackingId", async (c) => {
    try {
      const { trackingId } = c.req.param();

      const trackings = await select('delivery_tracking', { id: trackingId });
      if (trackings.length === 0) {
        return c.json({ error: 'Tracking not found' }, 404);
      }

      const tracking = trackings[0];

      // Get recent location history
      const history = await query(
        `SELECT lat, lng, recorded_at FROM delivery_location_history 
         WHERE tracking_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT 50`,
        [trackingId]
      );

      return c.json({
        success: true,
        tracking: {
          id: tracking.id,
          status: tracking.status,
          deliveryPerson: {
            name: tracking.delivery_person_name,
            phone: tracking.delivery_person_phone,
            photo: tracking.delivery_person_photo,
            vehicleNumber: tracking.vehicle_number,
          },
          currentLocation: tracking.current_lat ? {
            lat: parseFloat(tracking.current_lat),
            lng: parseFloat(tracking.current_lng),
            updatedAt: tracking.last_location_update,
          } : null,
          eta: tracking.eta_to_delivery_minutes,
          distanceRemaining: tracking.distance_remaining_km,
          timestamps: {
            assigned: tracking.assigned_at,
            reachedPickup: tracking.reached_pickup_at,
            pickedUp: tracking.picked_up_at,
            delivered: tracking.delivered_at,
          },
        },
        locationHistory: history.rows,
      });
    } catch (error: any) {
      console.error('Error getting tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /delivery/order/:orderType/:orderId
   * Get tracking by order ID
   */
  app.get("/delivery/order/:orderType/:orderId", async (c) => {
    try {
      const { orderType, orderId } = c.req.param();

      const column = orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';
      
      const result = await query(
        `SELECT * FROM delivery_tracking WHERE ${column} = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      if (result.rows.length === 0) {
        return c.json({ error: 'Tracking not found' }, 404);
      }

      const tracking = result.rows[0];

      return c.json({
        success: true,
        tracking: {
          id: tracking.id,
          status: tracking.status,
          deliveryPerson: {
            name: tracking.delivery_person_name,
            phone: tracking.delivery_person_phone,
            photo: tracking.delivery_person_photo,
            vehicleNumber: tracking.vehicle_number,
          },
          currentLocation: tracking.current_lat ? {
            lat: parseFloat(tracking.current_lat),
            lng: parseFloat(tracking.current_lng),
          } : null,
          eta: tracking.eta_to_delivery_minutes,
        },
      });
    } catch (error: any) {
      console.error('Error getting tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // DELIVERY PARTNER DASHBOARD
  // ============================================================================

  /**
   * GET /delivery/partner/:partnerId/orders
   * Get active orders for a delivery partner
   */
  app.get("/delivery/partner/:partnerId/orders", async (c) => {
    try {
      const { partnerId } = c.req.param();
      const status = c.req.query('status') || 'active';

      let statusFilter = "";
      if (status === 'active') {
        statusFilter = `AND dt.status NOT IN ('delivered', 'failed')`;
      } else if (status !== 'all') {
        statusFilter = `AND dt.status = '${status}'`;
      }

      const result = await query(
        `SELECT dt.*, 
                po.order_number as pharmacy_order_number,
                po.total_amount as pharmacy_total,
                po.delivery_address as pharmacy_address,
                po.payment_method as pharmacy_payment,
                mo.order_number as meal_order_number,
                mo.total_amount as meal_total,
                mo.delivery_address as meal_address
         FROM delivery_tracking dt
         LEFT JOIN pharmacy_orders po ON dt.pharmacy_order_id = po.id
         LEFT JOIN meal_orders mo ON dt.meal_order_id = mo.id
         WHERE dt.logistics_partner_id = $1 ${statusFilter}
         ORDER BY dt.created_at DESC`,
        [partnerId]
      );

      const orders = result.rows.map((row: any) => ({
        trackingId: row.id,
        orderType: row.pharmacy_order_id ? 'pharmacy' : 'meal',
        orderNumber: row.pharmacy_order_number || row.meal_order_number,
        totalAmount: row.pharmacy_total || row.meal_total,
        deliveryAddress: row.pharmacy_address || row.meal_address,
        paymentMethod: row.pharmacy_payment || 'online',
        status: row.status,
        deliveryOtp: row.delivery_otp,
        assignedAt: row.assigned_at,
      }));

      return c.json({
        success: true,
        orders,
        count: orders.length,
      });
    } catch (error: any) {
      console.error('Error getting partner orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /delivery/partner/:partnerId/earnings
   * Get earnings summary for delivery partner
   */
  app.get("/delivery/partner/:partnerId/earnings", async (c) => {
    try {
      const { partnerId } = c.req.param();
      const period = c.req.query('period') || 'today';

      let dateFilter = "";
      if (period === 'today') {
        dateFilter = `AND DATE(dt.delivered_at) = CURRENT_DATE`;
      } else if (period === 'week') {
        dateFilter = `AND dt.delivered_at >= NOW() - INTERVAL '7 days'`;
      } else if (period === 'month') {
        dateFilter = `AND dt.delivered_at >= NOW() - INTERVAL '30 days'`;
      }

      const result = await query(
        `SELECT 
           COUNT(*) as total_deliveries,
           SUM(COALESCE(po.delivery_fee, 0) + COALESCE(mo.delivery_fee, 0)) as total_delivery_fees
         FROM delivery_tracking dt
         LEFT JOIN pharmacy_orders po ON dt.pharmacy_order_id = po.id
         LEFT JOIN meal_orders mo ON dt.meal_order_id = mo.id
         WHERE dt.logistics_partner_id = $1 
         AND dt.status = 'delivered' ${dateFilter}`,
        [partnerId]
      );

      const stats = result.rows[0];

      return c.json({
        success: true,
        earnings: {
          period,
          totalDeliveries: parseInt(stats.total_deliveries) || 0,
          totalEarnings: parseFloat(stats.total_delivery_fees) || 0,
        },
      });
    } catch (error: any) {
      console.error('Error getting earnings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /delivery/available/:partnerId
   * Get available orders near partner location
   */
  app.get("/delivery/available/:partnerId", async (c) => {
    try {
      const { partnerId } = c.req.param();
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radiusKm = parseFloat(c.req.query('radius') || '10');

      // Find unassigned orders within radius
      // For now, return orders that need delivery partners
      const result = await query(
        `SELECT po.*, 'pharmacy' as order_type, v.business_name as vendor_name
         FROM pharmacy_orders po
         JOIN vendors v ON po.pharmacy_id = v.id
         WHERE po.status = 'ready_for_pickup'
         AND po.logistics_type = 'warmpawz'
         AND po.logistics_partner_id IS NULL
         UNION ALL
         SELECT mo.*, 'meal' as order_type, v.business_name as vendor_name
         FROM meal_orders mo
         JOIN vendors v ON mo.vendor_id = v.id
         WHERE mo.status = 'ready_for_pickup'
         AND mo.logistics_type = 'warmpawz'
         AND mo.logistics_partner_id IS NULL
         ORDER BY created_at DESC
         LIMIT 20`,
        []
      );

      return c.json({
        success: true,
        availableOrders: result.rows.map((o: any) => ({
          orderId: o.id,
          orderNumber: o.order_number,
          orderType: o.order_type,
          vendorName: o.vendor_name,
          totalAmount: o.total_amount,
          deliveryFee: o.delivery_fee,
          deliveryAddress: typeof o.delivery_address === 'string' 
            ? JSON.parse(o.delivery_address) 
            : o.delivery_address,
          paymentMethod: o.payment_method,
        })),
      });
    } catch (error: any) {
      console.error('Error getting available orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /delivery/accept/:orderId
   * Delivery partner accepts an order
   */
  app.post("/delivery/accept/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { 
        orderType, // 'pharmacy' or 'meal'
        partnerId,
        partnerName,
        partnerPhone,
        vehicleNumber,
      } = await c.req.json();

      // Check if order is still available
      const tableName = orderType === 'pharmacy' ? 'pharmacy_orders' : 'meal_orders';
      const orders = await select(tableName, { id: orderId });
      
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];
      if (order.logistics_partner_id) {
        return c.json({ error: 'Order already assigned', code: 'ALREADY_ASSIGNED' }, 409);
      }

      // Generate OTP
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Create tracking
      const tracking = await insert('delivery_tracking', {
        pharmacy_order_id: orderType === 'pharmacy' ? orderId : null,
        meal_order_id: orderType === 'meal' ? orderId : null,
        logistics_partner_id: partnerId,
        delivery_person_name: partnerName,
        delivery_person_phone: partnerPhone,
        vehicle_number: vehicleNumber,
        status: 'heading_to_pickup',
        delivery_otp: deliveryOtp,
        assigned_at: new Date().toISOString(),
      });

      // Update order
      await update(tableName, { id: orderId }, {
        logistics_partner_id: partnerId,
      });

      return c.json({
        success: true,
        tracking: tracking[0],
        deliveryOtp,
        message: 'Order accepted! Head to pickup location.',
      });
    } catch (error: any) {
      console.error('Error accepting order:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
