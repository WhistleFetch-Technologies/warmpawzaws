/**
 * ============================================================================
 * NUTRITION ORDER TRACKING ENDPOINTS
 * ============================================================================
 * 
 * Handles nutrition/meal order tracking and ETA updates
 * - Update preparation ETA
 * - Get order tracking information
 * 
 * Fixes GAP-9.3 & GAP-9.4: Nutritionist Flow Gaps
 * Date: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../database/rds-connection';

/**
 * PUT /nutrition/orders/:orderId/preparation-eta
 * Update preparation ETA for meal order
 * Fixes GAP-9.3: Preparation ETA Updates
 */
export function registerNutritionOrderEndpoints(app: Hono) {
  app.put("/nutrition/orders/:orderId/preparation-eta", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { eta } = body; // in minutes

      if (!eta || typeof eta !== 'number') {
        return c.json({ error: 'ETA in minutes is required' }, 400);
      }

      // ✅ FIX: meal_orders table doesn't have preparation_eta_minutes column
      // Use estimated_delivery_time to store the calculated preparation completion time
      const estimatedPreparationTime = new Date(Date.now() + eta * 60 * 1000).toISOString();
      
      // Update meal order with preparation ETA
      await update('meal_orders', { id: orderId }, {
        estimated_delivery_time: estimatedPreparationTime,
        updated_at: new Date().toISOString(),
      });

      // Notify customer about ETA update
      const order = await select('meal_orders', { id: orderId });
      if (order.length > 0) {
        console.log('Notifying customer about preparation ETA:', {
          orderId,
          customerId: order[0].customer_id,
          eta,
        });
      }

      return c.json({
        success: true,
        message: 'Preparation ETA updated',
        eta,
      });
    } catch (error: any) {
      console.error('Error updating preparation ETA:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /nutrition/orders/:orderId/tracking
   * Get meal order tracking information
   * Fixes GAP-9.4: Temporary Tracking Widget
   */
  app.get("/nutrition/orders/:orderId/tracking", async (c) => {
    try {
      const { orderId } = c.req.param();

      // Get order
      const orders = await select('meal_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Get tracking if exists
      const trackingResult = await query(
        `SELECT * FROM delivery_tracking WHERE meal_order_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      const tracking = trackingResult.rows[0] || null;

      // Get preparation ETA
      // ✅ FIX: meal_orders table doesn't have preparation_eta_minutes column
      // Calculate ETA from estimated_delivery_time if available
      const preparationETA = order.estimated_delivery_time 
        ? Math.max(0, Math.round((new Date(order.estimated_delivery_time).getTime() - Date.now()) / (60 * 1000)))
        : null;

      return c.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          trackingStatus: tracking?.status || order.status,
          preparationETA,
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
        steps: [
          { step: 'placed', status: order.status === 'placed' ? 'completed' : 'pending', timestamp: order.created_at },
          { step: 'preparing', status: ['preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered'].includes(order.status) ? 'completed' : 'pending', timestamp: order.preparation_started_at },
          { step: 'out_for_delivery', status: ['picked_up', 'on_the_way', 'delivered'].includes(order.status) ? 'completed' : 'pending', timestamp: tracking?.picked_up_at },
          { step: 'delivered', status: order.status === 'delivered' ? 'completed' : 'pending', timestamp: order.delivered_at },
        ],
      });
    } catch (error: any) {
      console.error('Error getting meal order tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Nutrition order endpoints registered');
}
