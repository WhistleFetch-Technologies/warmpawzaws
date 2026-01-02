import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🚚 DELIVERY INTEGRATION ENDPOINTS
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
 */

interface DeliveryPartner {
  partnerId: string;
  name: string;
  phone: string;
  vehicleType: 'bike' | 'scooter' | 'car' | 'van';
  vehicleNumber: string;
  currentLocation: {
    lat: number;
    lng: number;
    lastUpdated: string;
  };
  status: 'available' | 'on_delivery' | 'offline';
  rating: number;
  totalDeliveries: number;
  vendorId: string;
  isActive: boolean;
  createdAt: string;
}

interface Delivery {
  deliveryId: string;
  orderId: string;
  orderType: 'meal_plan' | 'supplement' | 'product';
  customerId: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
    contactPerson: string;
    contactPhone: string;
  };
  dropLocation: {
    address: string;
    lat: number;
    lng: number;
    instructions?: string;
  };
  partnerId?: string;
  partnerName?: string;
  partnerPhone?: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  scheduledDate: string;
  scheduledTime: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  estimatedDistance: number; // in km
  estimatedTime: number; // in minutes
  actualDistance?: number;
  actualTime?: number;
  deliveryFee: number;
  route?: Array<{
    lat: number;
    lng: number;
    timestamp?: string;
  }>;
  proofOfDelivery?: {
    photo?: string;
    signature?: string;
    receivedBy: string;
    notes?: string;
  };
  failureReason?: string;
  rating?: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryRoute {
  routeId: string;
  partnerId: string;
  deliveries: string[]; // delivery IDs
  optimizedOrder: Array<{
    deliveryId: string;
    sequence: number;
    estimatedArrival: string;
  }>;
  totalDistance: number;
  totalTime: number;
  status: 'planned' | 'in_progress' | 'completed';
  createdAt: string;
}

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
        remaining[i].dropLocation.lat,
        remaining[i].dropLocation.lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLocation = nearest.dropLocation;
  }

  return optimized;
}

// Find nearest available partner
async function findNearestPartner(
  kv: any,
  pickupLat: number,
  pickupLng: number
): Promise<DeliveryPartner | null> {
  const allPartners = await kv.getByPrefix('delivery:partner:') || [];
  
  const availablePartners = allPartners
    .map((item: any) => item.value || item)
    .filter((partner: any) => 
      partner.status === 'available' && partner.isActive
    );

  if (availablePartners.length === 0) {
    return null;
  }

  // Find nearest partner
  let nearest = availablePartners[0];
  let nearestDistance = calculateDistance(
    pickupLat,
    pickupLng,
    nearest.currentLocation.lat,
    nearest.currentLocation.lng
  );

  for (const partner of availablePartners) {
    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      partner.currentLocation.lat,
      partner.currentLocation.lng
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = partner;
    }
  }

  return nearest;
}

export function deliveryIntegrationEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      // Find nearest partner
      const partner = await findNearestPartner(
        kv,
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

      const delivery: Delivery = {
        deliveryId,
        orderId,
        orderType: orderType || 'product',
        customerId: customerId || '',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        pickupLocation,
        dropLocation,
        partnerId: partner.partnerId,
        partnerName: partner.name,
        partnerPhone: partner.phone,
        status: 'assigned',
        scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
        scheduledTime: scheduledTime || new Date().toTimeString().split(' ')[0],
        assignedAt: new Date().toISOString(),
        estimatedDistance: parseFloat(pickupToDropDistance.toFixed(2)),
        estimatedTime,
        deliveryFee: deliveryFee || 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`delivery:${deliveryId}`, delivery);

      // Update partner status
      partner.status = 'on_delivery';
      await kv.set(`delivery:partner:${partner.partnerId}`, partner);

      console.log(`✅ Delivery ${deliveryId} assigned to partner ${partner.partnerId}`);

      return sendSuccess(c, {
        delivery: {
          deliveryId,
          partnerId: partner.partnerId,
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

      const delivery = await kv.get(`delivery:${deliveryId}`);
      
      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      // Get partner current location
      let partnerLocation = null;
      if (delivery.partnerId) {
        const partner = await kv.get(`delivery:partner:${delivery.partnerId}`);
        if (partner) {
          partnerLocation = partner.currentLocation;
        }
      }

      return sendSuccess(c, {
        delivery,
        partnerLocation,
        eta: delivery.estimatedTime - Math.round(
          (new Date().getTime() - new Date(delivery.assignedAt || delivery.createdAt).getTime()) / 60000
        )
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

      const delivery = await kv.get(`delivery:${deliveryId}`);
      
      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      delivery.status = status;
      delivery.updatedAt = new Date().toISOString();

      if (status === 'picked_up') {
        delivery.pickedUpAt = new Date().toISOString();
      }

      if (status === 'delivered') {
        delivery.deliveredAt = new Date().toISOString();
        delivery.proofOfDelivery = proofOfDelivery;
        
        // Calculate actual time
        const startTime = new Date(delivery.pickedUpAt || delivery.assignedAt);
        const endTime = new Date();
        delivery.actualTime = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        // Free up partner
        if (delivery.partnerId) {
          const partner = await kv.get(`delivery:partner:${delivery.partnerId}`);
          if (partner) {
            partner.status = 'available';
            partner.totalDeliveries = (partner.totalDeliveries || 0) + 1;
            await kv.set(`delivery:partner:${delivery.partnerId}`, partner);
          }
        }
      }

      if (status === 'failed') {
        delivery.failureReason = failureReason;
        
        // Free up partner
        if (delivery.partnerId) {
          const partner = await kv.get(`delivery:partner:${delivery.partnerId}`);
          if (partner) {
            partner.status = 'available';
            await kv.set(`delivery:partner:${delivery.partnerId}`, partner);
          }
        }
      }

      // Update route if location provided
      if (location) {
        if (!delivery.route) {
          delivery.route = [];
        }
        delivery.route.push({
          ...location,
          timestamp: new Date().toISOString()
        });
      }

      await kv.set(`delivery:${deliveryId}`, delivery);

      console.log(`✅ Delivery ${deliveryId} status updated to: ${status}`);

      return sendSuccess(c, {
        deliveryId,
        status,
        updatedAt: delivery.updatedAt
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

      // Get all deliveries
      const deliveries: any[] = [];
      for (const id of deliveryIds) {
        const delivery = await kv.get(`delivery:${id}`);
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
        const partner = await kv.get(`delivery:partner:${partnerId}`);
        if (partner) {
          startLocation = partner.currentLocation;
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
          : optimized[index - 1].dropLocation;
        
        const distance = calculateDistance(
          prevLocation.lat,
          prevLocation.lng,
          delivery.dropLocation.lat,
          delivery.dropLocation.lng
        );

        totalDistance += distance;
        totalTime += Math.round(distance / 0.5); // 30 km/h average
        totalTime += 10; // Add 10 min per stop

        return {
          deliveryId: delivery.deliveryId,
          sequence: index + 1,
          estimatedArrival: new Date(Date.now() + totalTime * 60000).toISOString()
        };
      });

      const routeId = `ROUTE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const route: DeliveryRoute = {
        routeId,
        partnerId: partnerId || '',
        deliveries: deliveryIds,
        optimizedOrder,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        totalTime,
        status: 'planned',
        createdAt: new Date().toISOString()
      };

      await kv.set(`delivery:route:${routeId}`, route);

      console.log(`✅ Route optimized: ${routeId} (${deliveryIds.length} deliveries)`);

      return sendSuccess(c, { route }, 'Route optimized successfully');

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

      const partner: DeliveryPartner = {
        partnerId,
        name,
        phone,
        vehicleType,
        vehicleNumber,
        currentLocation: currentLocation || {
          lat: 28.6139,
          lng: 77.2090,
          lastUpdated: new Date().toISOString()
        },
        status: 'available',
        rating: 5.0,
        totalDeliveries: 0,
        vendorId,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await kv.set(`delivery:partner:${partnerId}`, partner);

      console.log(`✅ Delivery partner registered: ${partnerId}`);

      return sendSuccess(c, { partner }, 'Partner registered successfully');

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

      const partner = await kv.get(`delivery:partner:${partnerId}`);
      
      if (!partner) {
        return sendError(c, 'Partner not found', 404);
      }

      partner.currentLocation = {
        lat,
        lng,
        lastUpdated: new Date().toISOString()
      };

      await kv.set(`delivery:partner:${partnerId}`, partner);

      return sendSuccess(c, {
        partnerId,
        location: partner.currentLocation
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

      const allDeliveries = await kv.getByPrefix('delivery:DEL-') || [];
      
      let deliveries = allDeliveries
        .map((item: any) => item.value || item)
        .filter((delivery: any) => delivery.partnerId === partnerId);

      if (status) {
        deliveries = deliveries.filter((d: any) => d.status === status);
      }

      deliveries.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        partnerId,
        count: deliveries.length,
        deliveries
      });

    } catch (error) {
      console.error('❌ Error fetching partner orders:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Delivery Integration Endpoints registered');
}
