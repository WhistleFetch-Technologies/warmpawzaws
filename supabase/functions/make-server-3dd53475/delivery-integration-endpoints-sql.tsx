/**
 * ============================================================================
 * DELIVERY INTEGRATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete delivery management for nutritionist meal/supplement delivery
 * 
 * Features:
 * - Delivery partner assignment
 * - Real-time tracking
 * - Route optimization
 * - Status updates
 * - ETA calculation
 * - Proof of delivery
 * - Partner management
 * - Multi-order batching
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDeliveryIntegrationRepository } from "../../lib/repositories/delivery-integration.ts";

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Simple route optimization (nearest neighbor)
function optimizeRoute(deliveries: any[], startLocation: { lat: number; lng: number }): any[] {
  const optimized: any[] = [];
  const remaining = [...deliveries];
  let currentLocation = startLocation;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        remaining[i].drop_location.lat,
        remaining[i].drop_location.lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLocation = nearest.drop_location;
  }

  return optimized;
}

// Find nearest available partner
async function findNearestPartner(
  repo: ReturnType<typeof getDeliveryIntegrationRepository>,
  pickupLat: number,
  pickupLng: number
) {
  const availablePartners = await repo.getAvailableDeliveryPartners();

  if (availablePartners.length === 0) {
    return null;
  }

  // Find nearest partner
  let nearest = availablePartners[0];
  const loc = nearest.current_location || { lat: 0, lng: 0 };
  let nearestDistance = calculateDistance(
    pickupLat,
    pickupLng,
    loc.lat,
    loc.lng
  );

  for (const partner of availablePartners) {
    const partnerLoc = partner.current_location || { lat: 0, lng: 0 };
    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      partnerLoc.lat,
      partnerLoc.lng
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = partner;
    }
  }

  return nearest;
}

export function deliveryIntegrationEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const repo = getDeliveryIntegrationRepository();

  /**
   * POST /delivery/assign-partner
   * Assign delivery partner to an order
   */
  app.post(`${BASE_PATH}/delivery/assign-partner`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        orderId,
        orderType,
        customerId,
        customerName,
        customerPhone,
        pickupLocation,
        dropLocation,
        scheduledDate,
        scheduledTime,
        deliveryFee
      } = body;

      if (!orderId || !pickupLocation || !dropLocation) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Find nearest partner
      const partner = await findNearestPartner(
        repo,
        pickupLocation.lat,
        pickupLocation.lng
      );

      if (!partner) {
        return sendError(c, 'No delivery partners available', 404);
      }

      const deliveryId = `DEL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Calculate estimated distance and time
      const pickupToDropDistance = calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        dropLocation.lat,
        dropLocation.lng
      );

      const estimatedTime = Math.round(pickupToDropDistance / 0.5); // Assume 30 km/h average

      // ✅ SQL: Create delivery
      const delivery = await repo.createDelivery({
        delivery_id: deliveryId,
        order_id: orderId,
        order_type: orderType || 'product',
        customer_id: customerId,
        customer_name: customerName || '',
        customer_phone: customerPhone || '',
        pickup_location: pickupLocation,
        drop_location: dropLocation,
        partner_id: partner.partner_id,
        partner_name: partner.name,
        partner_phone: partner.phone,
        status: 'assigned',
        scheduled_date: scheduledDate || new Date().toISOString().split('T')[0],
        scheduled_time: scheduledTime || new Date().toTimeString().split(' ')[0],
        estimated_distance: parseFloat(pickupToDropDistance.toFixed(2)),
        estimated_time: estimatedTime,
        delivery_fee: deliveryFee || 50
      });

      // ✅ SQL: Update partner status
      await repo.updateDeliveryPartner(partner.partner_id, {
        status: 'on_delivery'
      });

      console.log(`✅ Delivery ${deliveryId} assigned to partner ${partner.partner_id}`);

      return sendSuccess(c, {
        delivery: {
          deliveryId,
          partnerId: partner.partner_id,
          partnerName: partner.name,
          partnerPhone: partner.phone,
          estimatedTime,
          status: 'assigned'
        }
      }, 'Delivery partner assigned successfully');

    } catch (error) {
      console.error('❌ Error assigning partner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /delivery/tracking/:deliveryId
   * Track delivery in real-time
   */
  app.get(`${BASE_PATH}/delivery/tracking/:deliveryId`, async (c) => {
    try {
      const { deliveryId } = c.req.param();

      // ✅ SQL: Get delivery
      const delivery = await repo.getDeliveryByDeliveryId(deliveryId);
      
      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      // ✅ SQL: Get partner current location
      let partnerLocation = null;
      if (delivery.partner_id) {
        const partner = await repo.getDeliveryPartnerByPartnerId(delivery.partner_id);
        if (partner) {
          partnerLocation = partner.current_location;
        }
      }

      const assignedAt = delivery.assigned_at || delivery.created_at;
      const elapsedMinutes = Math.round(
        (new Date().getTime() - new Date(assignedAt).getTime()) / 60000
      );
      const eta = Math.max(0, (delivery.estimated_time || 0) - elapsedMinutes);

      return sendSuccess(c, {
        delivery: {
          deliveryId: delivery.delivery_id,
          orderId: delivery.order_id,
          status: delivery.status,
          pickupLocation: delivery.pickup_location,
          dropLocation: delivery.drop_location,
          partnerId: delivery.partner_id,
          partnerName: delivery.partner_name,
          assignedAt: delivery.assigned_at,
          pickedUpAt: delivery.picked_up_at,
          deliveredAt: delivery.delivered_at,
          estimatedTime: delivery.estimated_time,
          route: delivery.route
        },
        partnerLocation,
        eta
      });

    } catch (error) {
      console.error('❌ Error tracking delivery:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /delivery/update-status
   * Update delivery status
   */
  app.post(`${BASE_PATH}/delivery/update-status`, async (c) => {
    try {
      const body = await c.req.json();
      const { deliveryId, status, location, proofOfDelivery, failureReason } = body;

      const validStatuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'];
      
      if (!status || !validStatuses.includes(status)) {
        return sendError(c, 'Invalid status', 400);
      }

      // ✅ SQL: Get delivery
      const delivery = await repo.getDeliveryByDeliveryId(deliveryId);
      
      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      const updateData: any = {
        status: status
      };

      if (status === 'picked_up') {
        updateData.picked_up_at = new Date().toISOString();
      }

      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
        updateData.proof_of_delivery = proofOfDelivery;
        
        // Calculate actual time
        const startTime = new Date(delivery.picked_up_at || delivery.assigned_at || delivery.created_at);
        const endTime = new Date();
        updateData.actual_time = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        // ✅ SQL: Free up partner
        if (delivery.partner_id) {
          const partner = await repo.getDeliveryPartnerByPartnerId(delivery.partner_id);
          if (partner) {
            await repo.updateDeliveryPartner(delivery.partner_id, {
              status: 'available',
              total_deliveries: (partner.total_deliveries || 0) + 1
            });
          }
        }
      }

      if (status === 'failed') {
        updateData.failure_reason = failureReason;
        
        // ✅ SQL: Free up partner
        if (delivery.partner_id) {
          const partner = await repo.getDeliveryPartnerByPartnerId(delivery.partner_id);
          if (partner) {
            await repo.updateDeliveryPartner(delivery.partner_id, {
              status: 'available'
            });
          }
        }
      }

      // Update route if location provided
      if (location) {
        const route = delivery.route || [];
        route.push({
          ...location,
          timestamp: new Date().toISOString()
        });
        updateData.route = route;
      }

      // ✅ SQL: Update delivery
      const updatedDelivery = await repo.updateDelivery(deliveryId, updateData);

      console.log(`✅ Delivery ${deliveryId} status updated to: ${status}`);

      return sendSuccess(c, {
        deliveryId,
        status,
        updatedAt: updatedDelivery.updated_at
      }, 'Status updated successfully');

    } catch (error) {
      console.error('❌ Error updating status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /delivery/optimize-route
   * Optimize delivery route for multiple orders
   */
  app.post(`${BASE_PATH}/delivery/optimize-route`, async (c) => {
    try {
      const body = await c.req.json();
      const { deliveryIds, partnerId } = body;

      if (!deliveryIds || deliveryIds.length === 0) {
        return sendError(c, 'No deliveries provided', 400);
      }

      // ✅ SQL: Get all deliveries
      const deliveries: any[] = [];
      for (const id of deliveryIds) {
        const delivery = await repo.getDeliveryByDeliveryId(id);
        if (delivery) {
          deliveries.push(delivery);
        }
      }

      if (deliveries.length === 0) {
        return sendError(c, 'No valid deliveries found', 404);
      }

      // Get partner location
      let startLocation = { lat: 28.6139, lng: 77.2090 }; // Default Delhi
      if (partnerId) {
        const partner = await repo.getDeliveryPartnerByPartnerId(partnerId);
        if (partner && partner.current_location) {
          startLocation = partner.current_location;
        }
      }

      // Optimize route
      const optimized = optimizeRoute(deliveries, startLocation);

      // Calculate cumulative times
      let totalDistance = 0;
      let totalTime = 0;
      const optimizedOrder = optimized.map((delivery, index) => {
        const prevLocation = index === 0 
          ? startLocation 
          : optimized[index - 1].drop_location;
        
        const distance = calculateDistance(
          prevLocation.lat,
          prevLocation.lng,
          delivery.drop_location.lat,
          delivery.drop_location.lng
        );

        totalDistance += distance;
        totalTime += Math.round(distance / 0.5); // 30 km/h average
        totalTime += 10; // Add 10 min per stop

        return {
          deliveryId: delivery.delivery_id,
          sequence: index + 1,
          estimatedArrival: new Date(Date.now() + totalTime * 60000).toISOString()
        };
      });

      const routeId = `ROUTE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create route
      const route = await repo.createDeliveryRoute({
        route_id: routeId,
        partner_id: partnerId,
        deliveries: deliveryIds,
        optimized_order: optimizedOrder,
        total_distance: parseFloat(totalDistance.toFixed(2)),
        total_time: totalTime,
        status: 'planned'
      });

      console.log(`✅ Route optimized: ${routeId} (${deliveryIds.length} deliveries)`);

      return sendSuccess(c, {
        route: {
          routeId: route.route_id,
          partnerId: route.partner_id,
          deliveries: route.deliveries,
          optimizedOrder: route.optimized_order,
          totalDistance: route.total_distance,
          totalTime: route.total_time,
          status: route.status,
          createdAt: route.created_at
        }
      }, 'Route optimized successfully');

    } catch (error) {
      console.error('❌ Error optimizing route:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /delivery/partner/register
   * Register delivery partner
   */
  app.post(`${BASE_PATH}/delivery/partner/register`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        name,
        phone,
        vehicleType,
        vehicleNumber,
        currentLocation
      } = body;

      if (!vendorId || !name || !phone || !vehicleType || !vehicleNumber) {
        return sendError(c, 'Missing required fields', 400);
      }

      const partnerId = `PARTNER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create partner
      const partner = await repo.createDeliveryPartner({
        partner_id: partnerId,
        vendor_id: vendorId,
        name,
        phone,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        current_location: currentLocation || {
          lat: 28.6139,
          lng: 77.2090,
          lastUpdated: new Date().toISOString()
        },
        status: 'available'
      });

      console.log(`✅ Delivery partner registered: ${partnerId}`);

      return sendSuccess(c, {
        partner: {
          partnerId: partner.partner_id,
          name: partner.name,
          phone: partner.phone,
          vehicleType: partner.vehicle_type,
          vehicleNumber: partner.vehicle_number,
          status: partner.status,
          createdAt: partner.created_at
        }
      }, 'Partner registered successfully');

    } catch (error) {
      console.error('❌ Error registering partner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /delivery/partner/:partnerId/location
   * Update partner location
   */
  app.post(`${BASE_PATH}/delivery/partner/:partnerId/location`, async (c) => {
    try {
      const { partnerId } = c.req.param();
      const body = await c.req.json();
      const { lat, lng } = body;

      if (lat === undefined || lng === undefined) {
        return sendError(c, 'Missing lat/lng', 400);
      }

      // ✅ SQL: Get partner
      const partner = await repo.getDeliveryPartnerByPartnerId(partnerId);
      
      if (!partner) {
        return sendError(c, 'Partner not found', 404);
      }

      // ✅ SQL: Update location
      const updatedPartner = await repo.updateDeliveryPartner(partnerId, {
        current_location: {
          lat,
          lng,
          lastUpdated: new Date().toISOString()
        }
      });

      return sendSuccess(c, {
        partnerId,
        location: updatedPartner.current_location
      }, 'Location updated');

    } catch (error) {
      console.error('❌ Error updating location:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /delivery/partner/:partnerId/orders
   * Get partner's orders
   */
  app.get(`${BASE_PATH}/delivery/partner/:partnerId/orders`, async (c) => {
    try {
      const { partnerId } = c.req.param();
      const status = c.req.query('status');

      // ✅ SQL: Get deliveries by partner
      const deliveries = await repo.getDeliveriesByPartner(partnerId, status || undefined);

      return sendSuccess(c, {
        partnerId,
        count: deliveries.length,
        deliveries: deliveries.map((d: any) => ({
          deliveryId: d.delivery_id,
          orderId: d.order_id,
          status: d.status,
          pickupLocation: d.pickup_location,
          dropLocation: d.drop_location,
          scheduledDate: d.scheduled_date,
          scheduledTime: d.scheduled_time,
          createdAt: d.created_at
        }))
      });

    } catch (error) {
      console.error('❌ Error fetching partner orders:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Delivery Integration Endpoints (SQL) registered');
}

