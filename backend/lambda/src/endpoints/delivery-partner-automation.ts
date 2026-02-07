/**
 * ============================================================================
 * DELIVERY PARTNER AUTOMATION
 * ============================================================================
 * 
 * Automated delivery partner assignment system
 * - Auto-assign based on proximity and availability
 * - Load balancing across partners
 * - Real-time tracking integration
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, update } from '../database/rds-connection';
import { websocketService } from '../lib/services/websocket-service';
import { sendEventNotification } from '../lib/services/push-notification-service';

// Haversine formula for distance calculation
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

// Export helper function for internal use
export async function autoAssignDeliveryPartner(
  orderId: string,
  orderType: 'pharmacy' | 'meal',
  pickupLocation: { lat: number; lng: number },
  deliveryLocation: { lat: number; lng: number },
  priority: 'normal' | 'urgent' = 'normal'
): Promise<any> {
  // Find available delivery partners
  const partners = await query(
    `SELECT 
      dp.*,
      dp.current_lat as lat,
      dp.current_lng as lng,
      COUNT(da.id) as active_deliveries
     FROM delivery_partners dp
     LEFT JOIN delivery_assignments da ON dp.id = da.partner_id 
       AND da.status IN ('assigned', 'picked_up', 'in_transit')
     WHERE dp.is_active = true
     AND dp.is_available = true
     AND dp.status = 'online'
     GROUP BY dp.id
     HAVING COUNT(da.id) < dp.max_concurrent_deliveries
     ORDER BY dp.rating DESC NULLS LAST`,
    []
  );

  if ((partners as any).rows.length === 0) {
    return null;
  }

  // Calculate distances and scores
  const scoredPartners = (partners as any).rows.map((partner: any) => {
    const distanceToPickup = calculateDistance(
      pickupLocation.lat,
      pickupLocation.lng,
      partner.lat || 0,
      partner.lng || 0
    );

    const distanceScore = 100 / (1 + distanceToPickup);
    const ratingScore = (partner.rating || 3.5) * 20;
    const loadScore = 100 / (1 + partner.active_deliveries);
    const priorityBonus = priority === 'urgent' ? 50 : 0;

    return {
      ...partner,
      distanceToPickup,
      score: distanceScore + ratingScore + loadScore + priorityBonus,
    };
  });

  scoredPartners.sort((a, b) => b.score - a.score);
  const selectedPartner = scoredPartners[0];

  // Create delivery assignment
  const assignment = await query(
    `INSERT INTO delivery_assignments (
      order_id,
      order_type,
      partner_id,
      pickup_location,
      delivery_location,
      status,
      priority,
      estimated_pickup_time,
      estimated_delivery_time,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *`,
    [
      orderId,
      orderType,
      selectedPartner.id,
      JSON.stringify(pickupLocation),
      JSON.stringify(deliveryLocation),
      'assigned',
      priority,
      new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    ]
  );

  return {
    assignment: (assignment as any).rows[0],
    partner: selectedPartner,
  };
}

export function registerDeliveryPartnerAutomationEndpoints(app: Hono) {

  /**
   * POST /delivery/auto-assign
   * Automatically assign delivery partner to order
   */
  app.post("/delivery/auto-assign", async (c) => {
    try {
      const body = await c.req.json();
      const {
        orderId,
        orderType, // 'pharmacy' | 'meal'
        pickupLocation,
        deliveryLocation,
        priority = 'normal', // 'normal' | 'urgent'
      } = body;

      if (!orderId || !pickupLocation || !deliveryLocation) {
        return c.json({ error: 'orderId, pickupLocation, and deliveryLocation are required' }, 400);
      }

      // Find available delivery partners
      const partners = await query(
        `SELECT 
          dp.*,
          dp.current_lat as lat,
          dp.current_lng as lng,
          COUNT(da.id) as active_deliveries
         FROM delivery_partners dp
         LEFT JOIN delivery_assignments da ON dp.id = da.partner_id 
           AND da.status IN ('assigned', 'picked_up', 'in_transit')
         WHERE dp.is_active = true
         AND dp.is_available = true
         AND dp.status = 'online'
         GROUP BY dp.id
         HAVING COUNT(da.id) < dp.max_concurrent_deliveries
         ORDER BY dp.rating DESC NULLS LAST`,
        []
      );

      if ((partners as any).rows.length === 0) {
        return c.json({
          success: false,
          error: 'No available delivery partners',
          message: 'All delivery partners are currently busy. Please try again later.',
        });
      }

      // Calculate distances and scores
      const scoredPartners = (partners as any).rows.map((partner: any) => {
        const distanceToPickup = calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          partner.lat || 0,
          partner.lng || 0
        );

        const totalDistance = distanceToPickup + calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          deliveryLocation.lat,
          deliveryLocation.lng
        );

        // Score based on:
        // - Distance to pickup (lower is better)
        // - Rating (higher is better)
        // - Active deliveries (lower is better)
        // - Priority handling
        const distanceScore = 100 / (1 + distanceToPickup);
        const ratingScore = (partner.rating || 3.5) * 20;
        const loadScore = 100 / (1 + partner.active_deliveries);
        const priorityBonus = priority === 'urgent' ? 50 : 0;

        const totalScore = distanceScore + ratingScore + loadScore + priorityBonus;

        return {
          ...partner,
          distanceToPickup,
          totalDistance,
          score: totalScore,
        };
      });

      // Sort by score (highest first)
      scoredPartners.sort((a, b) => b.score - a.score);

      // Select best partner
      const selectedPartner = scoredPartners[0];

      // Create delivery assignment
      const assignment = await query(
        `INSERT INTO delivery_assignments (
          order_id,
          order_type,
          partner_id,
          pickup_location,
          delivery_location,
          status,
          priority,
          estimated_pickup_time,
          estimated_delivery_time,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [
          orderId,
          orderType,
          selectedPartner.id,
          JSON.stringify(pickupLocation),
          JSON.stringify(deliveryLocation),
          'assigned',
          priority,
          new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min ETA
          new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 min ETA
        ]
      );

      // Update partner availability if at max capacity
      if (selectedPartner.active_deliveries + 1 >= selectedPartner.max_concurrent_deliveries) {
        await update('delivery_partners', { id: selectedPartner.id }, {
          is_available: false,
        });
      }

      // Notify delivery partner
      await sendEventNotification({
        eventType: 'pharmacy_order_dispatched', // Reuse event type
        recipientId: selectedPartner.id,
        recipientType: 'vendor', // Delivery partners are vendors
        relatedId: orderId,
        data: {
          orderId,
          orderType,
          pickupLocation,
          deliveryLocation,
          assignmentId: (assignment as any).rows[0].id,
        },
      });

      // Send WebSocket update
      await websocketService.sendDeliveryUpdate(orderId, {
        status: 'assigned',
        deliveryPartner: selectedPartner.name,
        eta: 45,
      });

      return c.json({
        success: true,
        assignment: (assignment as any).rows[0],
        partner: {
          id: selectedPartner.id,
          name: selectedPartner.name,
          phone: selectedPartner.phone,
          rating: selectedPartner.rating,
          distanceToPickup: selectedPartner.distanceToPickup.toFixed(2),
        },
        estimatedPickupTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      });
    } catch (error: any) {
      console.error('Error auto-assigning delivery partner:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /delivery/:assignmentId/update-status
   * Update delivery status (picked up, in transit, delivered)
   */
  app.post("/delivery/:assignmentId/update-status", async (c) => {
    try {
      const { assignmentId } = c.req.param();
      const body = await c.req.json();
      const { status, location } = body;

      if (!['picked_up', 'in_transit', 'delivered', 'cancelled'].includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      // Update assignment
      await update('delivery_assignments', { id: assignmentId }, {
        status,
        updated_at: new Date().toISOString(),
        ...(location && { current_location: JSON.stringify(location) }),
        ...(status === 'delivered' && { delivered_at: new Date().toISOString() }),
      });

      // Get assignment details
      const assignment = await query(
        `SELECT * FROM delivery_assignments WHERE id = $1`,
        [assignmentId]
      );

      const assignmentData = (assignment as any).rows[0];

      // Update order status
      if (status === 'picked_up') {
        if (assignmentData.order_type === 'pharmacy') {
          await update('pharmacy_orders', { id: assignmentData.order_id }, {
            status: 'in_transit',
          });
        } else {
          await update('orders', { id: assignmentData.order_id }, {
            status: 'in_transit',
          });
        }
      } else if (status === 'delivered') {
        if (assignmentData.order_type === 'pharmacy') {
          await update('pharmacy_orders', { id: assignmentData.order_id }, {
            status: 'delivered',
            delivered_at: new Date().toISOString(),
          });
        } else {
          await update('orders', { id: assignmentData.order_id }, {
            status: 'delivered',
            delivered_at: new Date().toISOString(),
          });
        }

        // Free up partner
        await update('delivery_partners', { id: assignmentData.partner_id }, {
          is_available: true,
        });
      }

      // Send WebSocket update
      await websocketService.sendDeliveryUpdate(assignmentData.order_id, {
        status,
        location,
        eta: status === 'in_transit' ? 15 : undefined,
      });

      // Notify customer
      const order = assignmentData.order_type === 'pharmacy'
        ? await select('pharmacy_orders', { id: assignmentData.order_id })
        : await select('orders', { id: assignmentData.order_id });

      if (order.length > 0) {
        await sendEventNotification({
          eventType: status === 'picked_up' ? 'pharmacy_order_dispatched' : 
                     status === 'delivered' ? 'pharmacy_order_delivered' : 
                     'pharmacy_order_preparing',
          recipientId: order[0].customer_id,
          recipientType: 'customer',
          relatedId: assignmentData.order_id,
          data: {
            status,
            orderId: assignmentData.order_id,
          },
        });
      }

      return c.json({
        success: true,
        message: `Delivery status updated to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating delivery status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /delivery/:assignmentId/tracking
   * Get real-time delivery tracking
   */
  app.get("/delivery/:assignmentId/tracking", async (c) => {
    try {
      const { assignmentId } = c.req.param();

      const result = await query(
        `SELECT 
          da.*,
          dp.name as partner_name,
          dp.phone as partner_phone,
          dp.vehicle_type,
          dp.vehicle_number
         FROM delivery_assignments da
         JOIN delivery_partners dp ON da.partner_id = dp.id
         WHERE da.id = $1`,
        [assignmentId]
      );

      if ((result as any).rows.length === 0) {
        return c.json({ error: 'Assignment not found' }, 404);
      }

      const assignment = (result as any).rows[0];

      return c.json({
        success: true,
        tracking: {
          status: assignment.status,
          partner: {
            name: assignment.partner_name,
            phone: assignment.partner_phone,
            vehicleType: assignment.vehicle_type,
            vehicleNumber: assignment.vehicle_number,
          },
          pickupLocation: JSON.parse(assignment.pickup_location || '{}'),
          deliveryLocation: JSON.parse(assignment.delivery_location || '{}'),
          currentLocation: assignment.current_location ? JSON.parse(assignment.current_location) : null,
          estimatedPickupTime: assignment.estimated_pickup_time,
          estimatedDeliveryTime: assignment.estimated_delivery_time,
          pickedUpAt: assignment.picked_up_at,
          deliveredAt: assignment.delivered_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
