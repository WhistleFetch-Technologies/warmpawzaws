import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🚚 HYPERLOCAL DELIVERY SYSTEM
 * 
 * Complete hyperlocal delivery management for nutritionist food delivery
 * 
 * Features:
 * - Location-based vendor matching
 * - Delivery route optimization
 * - GPS tracking integration
 * - Real-time delivery status
 * - ETA calculation
 * - Delivery partner management
 */

interface DeliveryOrder {
  id: string;
  orderId: string;
  customerId: string;
  vendorId: string;
  nutritionistId?: string;
  
  // Items
  items: {
    mealPlanId?: string;
    productId?: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  
  // Location
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
    contactName: string;
    contactPhone: string;
  };
  
  dropoffLocation: {
    address: string;
    lat: number;
    lng: number;
    contactName: string;
    contactPhone: string;
  };
  
  // Delivery
  distance: number; // km
  estimatedDuration: number; // minutes
  deliveryFee: number;
  
  // Tracking
  status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryPartnerId?: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  
  // GPS Tracking
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  
  // Timeline
  orderedAt: string;
  confirmedAt?: string;
  preparedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  
  // OTP
  pickupOtp?: string;
  deliveryOtp?: string;
  
  // Notes
  instructions?: string;
  notes?: string;
}

export function hyperlocalDeliveryEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate delivery fee based on distance
   */
  function calculateDeliveryFee(distance: number): number {
    // Base fee + per km charge
    const baseFee = 30;
    const perKmCharge = 10;
    
    if (distance <= 2) return baseFee;
    return baseFee + (distance - 2) * perKmCharge;
  }

  /**
   * Estimate delivery duration (minutes)
   */
  function estimateDeliveryDuration(distance: number): number {
    // Assume average speed of 20 km/h in city
    const travelTime = (distance / 20) * 60;
    
    // Add preparation time (15 min) + buffer (5 min)
    return Math.ceil(travelTime + 20);
  }

  /**
   * Generate OTP
   */
  function generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Find nearby vendors for hyperlocal delivery
   */
  async function findNearbyVendors(lat: number, lng: number, maxDistance: number = 5) {
    const allVendors = await kv.getByPrefix('vendor:') || [];
    
    const nearbyVendors = [];
    
    for (const item of allVendors) {
      const vendor = item.value || item;
      
      // Check if vendor has delivery service
      if (!vendor.services || !vendor.services.includes('nutritionist')) continue;
      if (!vendor.location || !vendor.location.lat || !vendor.location.lng) continue;
      
      const distance = calculateDistance(
        lat,
        lng,
        vendor.location.lat,
        vendor.location.lng
      );
      
      if (distance <= maxDistance) {
        nearbyVendors.push({
          ...vendor,
          distance,
          deliveryFee: calculateDeliveryFee(distance),
          estimatedDuration: estimateDeliveryDuration(distance)
        });
      }
    }
    
    // Sort by distance
    nearbyVendors.sort((a, b) => a.distance - b.distance);
    
    return nearbyVendors;
  }

  /**
   * Find available delivery partners
   */
  async function findAvailableDeliveryPartners(pickupLat: number, pickupLng: number, maxDistance: number = 3) {
    // In production, this would integrate with delivery partner APIs
    // For now, we'll use internal delivery staff
    
    const allStaff = await kv.getByPrefix('staff:') || [];
    
    const availablePartners = [];
    
    for (const item of allStaff) {
      const staff = item.value || item;
      
      // Check if staff is delivery partner
      if (!staff.roles || !staff.roles.includes('delivery_partner')) continue;
      if (staff.availability !== 'available') continue;
      
      // Check location if available
      if (staff.currentLocation && staff.currentLocation.lat && staff.currentLocation.lng) {
        const distance = calculateDistance(
          pickupLat,
          pickupLng,
          staff.currentLocation.lat,
          staff.currentLocation.lng
        );
        
        if (distance <= maxDistance) {
          availablePartners.push({
            id: staff.id,
            name: staff.name,
            phone: staff.phone,
            distance,
            rating: staff.rating || 0,
            totalDeliveries: staff.totalDeliveries || 0
          });
        }
      }
    }
    
    // Sort by distance and rating
    availablePartners.sort((a, b) => {
      const scoreA = (1 / (a.distance + 0.1)) * a.rating;
      const scoreB = (1 / (b.distance + 0.1)) * b.rating;
      return scoreB - scoreA;
    });
    
    return availablePartners;
  }

  // ============================================
  // CUSTOMER ENDPOINTS
  // ============================================

  /**
   * GET /hyperlocal/vendors
   * Find nearby vendors for delivery
   */
  app.get(`${BASE_PATH}/hyperlocal/vendors`, async (c) => {
    try {
      const { lat, lng, maxDistance } = c.req.query();

      if (!lat || !lng) {
        return sendError(c, 'Location coordinates required', 400);
      }

      const vendors = await findNearbyVendors(
        parseFloat(lat),
        parseFloat(lng),
        maxDistance ? parseFloat(maxDistance) : 5
      );

      return sendSuccess(c, { vendors, total: vendors.length });

    } catch (error) {
      console.error('❌ Error finding nearby vendors:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /hyperlocal/delivery/create
   * Create delivery order
   */
  app.post(`${BASE_PATH}/hyperlocal/delivery/create`, async (c) => {
    try {
      const {
        orderId,
        customerId,
        vendorId,
        nutritionistId,
        items,
        pickupLocation,
        dropoffLocation,
        instructions
      } = await c.req.json();

      console.log(`🚚 Creating hyperlocal delivery for order ${orderId}`);

      // Calculate distance and fees
      const distance = calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        dropoffLocation.lat,
        dropoffLocation.lng
      );

      const deliveryFee = calculateDeliveryFee(distance);
      const estimatedDuration = estimateDeliveryDuration(distance);

      // Create delivery order
      const deliveryId = `DEL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const delivery: DeliveryOrder = {
        id: deliveryId,
        orderId,
        customerId,
        vendorId,
        nutritionistId,
        items,
        pickupLocation,
        dropoffLocation,
        distance,
        estimatedDuration,
        deliveryFee,
        status: 'pending',
        pickupOtp: generateOTP(),
        deliveryOtp: generateOTP(),
        orderedAt: new Date().toISOString(),
        instructions
      };

      // Save delivery
      await kv.set(`delivery:${deliveryId}`, delivery);

      // Add to customer's deliveries
      const customerDeliveries = await kv.get(`customer:${customerId}:deliveries`) || [];
      customerDeliveries.unshift(deliveryId);
      await kv.set(`customer:${customerId}:deliveries`, customerDeliveries);

      // Add to vendor's deliveries
      const vendorDeliveries = await kv.get(`vendor:${vendorId}:deliveries`) || [];
      vendorDeliveries.unshift(deliveryId);
      await kv.set(`vendor:${vendorId}:deliveries`, vendorDeliveries);

      console.log(`✅ Delivery created: ${deliveryId}`);

      // TODO: Send notification to vendor
      // TODO: Find and assign delivery partner

      return sendSuccess(c, { delivery, message: 'Delivery order created successfully' });

    } catch (error) {
      console.error('❌ Error creating delivery:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /hyperlocal/delivery/:deliveryId
   * Get delivery details
   */
  app.get(`${BASE_PATH}/hyperlocal/delivery/:deliveryId`, async (c) => {
    try {
      const { deliveryId } = c.req.param();

      const delivery = await kv.get(`delivery:${deliveryId}`);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      return sendSuccess(c, { delivery });

    } catch (error) {
      console.error('❌ Error fetching delivery:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /hyperlocal/delivery/:deliveryId/track
   * Track delivery in real-time
   */
  app.get(`${BASE_PATH}/hyperlocal/delivery/:deliveryId/track`, async (c) => {
    try {
      const { deliveryId } = c.req.param();

      const delivery = await kv.get(`delivery:${deliveryId}`);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      // Get current GPS location if delivery partner assigned
      let partnerLocation = null;
      if (delivery.deliveryPartnerId) {
        const staff = await kv.get(`staff:${delivery.deliveryPartnerId}`);
        if (staff && staff.currentLocation) {
          partnerLocation = staff.currentLocation;
        }
      }

      return sendSuccess(c, {
        delivery: {
          id: delivery.id,
          status: delivery.status,
          pickupLocation: delivery.pickupLocation,
          dropoffLocation: delivery.dropoffLocation,
          deliveryPartnerName: delivery.deliveryPartnerName,
          deliveryPartnerPhone: delivery.deliveryPartnerPhone,
          currentLocation: partnerLocation,
          estimatedDuration: delivery.estimatedDuration,
          pickedUpAt: delivery.pickedUpAt,
          deliveredAt: delivery.deliveredAt
        }
      });

    } catch (error) {
      console.error('❌ Error tracking delivery:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/:customerId/deliveries
   * Get customer's deliveries
   */
  app.get(`${BASE_PATH}/customer/:customerId/deliveries`, async (c) => {
    try {
      const { customerId } = c.req.param();

      const deliveryIds = await kv.get(`customer:${customerId}:deliveries`) || [];

      const deliveries = [];
      for (const id of deliveryIds) {
        const delivery = await kv.get(`delivery:${id}`);
        if (delivery) {
          deliveries.push(delivery);
        }
      }

      return sendSuccess(c, { deliveries, total: deliveries.length });

    } catch (error) {
      console.error('❌ Error fetching deliveries:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/deliveries
   * Get vendor's delivery orders
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/deliveries`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status } = c.req.query();

      const deliveryIds = await kv.get(`vendor:${vendorId}:deliveries`) || [];

      const deliveries = [];
      for (const id of deliveryIds) {
        const delivery = await kv.get(`delivery:${id}`);
        if (delivery) {
          if (!status || delivery.status === status) {
            deliveries.push(delivery);
          }
        }
      }

      return sendSuccess(c, { deliveries, total: deliveries.length });

    } catch (error) {
      console.error('❌ Error fetching vendor deliveries:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/delivery/:deliveryId/status
   * Update delivery status
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/delivery/:deliveryId/status`, async (c) => {
    try {
      const { vendorId, deliveryId } = c.req.param();
      const { status, notes } = await c.req.json();

      const delivery = await kv.get(`delivery:${deliveryId}`);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      if (delivery.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Update status
      const oldStatus = delivery.status;
      delivery.status = status;

      // Update timestamps
      if (status === 'confirmed') {
        delivery.confirmedAt = new Date().toISOString();
        
        // Auto-assign delivery partner
        const partners = await findAvailableDeliveryPartners(
          delivery.pickupLocation.lat,
          delivery.pickupLocation.lng
        );
        
        if (partners.length > 0) {
          delivery.deliveryPartnerId = partners[0].id;
          delivery.deliveryPartnerName = partners[0].name;
          delivery.deliveryPartnerPhone = partners[0].phone;
        }
      } else if (status === 'ready_for_pickup') {
        delivery.preparedAt = new Date().toISOString();
      }

      if (notes) {
        delivery.notes = (delivery.notes || '') + '\n' + notes;
      }

      await kv.set(`delivery:${deliveryId}`, delivery);

      console.log(`✅ Delivery ${deliveryId} status updated: ${oldStatus} → ${status}`);

      // TODO: Send notification to customer
      // TODO: Send notification to delivery partner

      return sendSuccess(c, { delivery, message: 'Delivery status updated' });

    } catch (error) {
      console.error('❌ Error updating delivery status:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // DELIVERY PARTNER ENDPOINTS
  // ============================================

  /**
   * GET /delivery-partner/:partnerId/deliveries
   * Get assigned deliveries
   */
  app.get(`${BASE_PATH}/delivery-partner/:partnerId/deliveries`, async (c) => {
    try {
      const { partnerId } = c.req.param();
      const { status } = c.req.query();

      const allDeliveries = await kv.getByPrefix('delivery:') || [];

      const assignedDeliveries = allDeliveries
        .map((item: any) => item.value || item)
        .filter((d: any) => d.deliveryPartnerId === partnerId)
        .filter((d: any) => !status || d.status === status);

      return sendSuccess(c, { deliveries: assignedDeliveries, total: assignedDeliveries.length });

    } catch (error) {
      console.error('❌ Error fetching partner deliveries:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /delivery-partner/:partnerId/delivery/:deliveryId/pickup
   * Mark delivery as picked up
   */
  app.put(`${BASE_PATH}/delivery-partner/:partnerId/delivery/:deliveryId/pickup`, async (c) => {
    try {
      const { partnerId, deliveryId } = c.req.param();
      const { otp } = await c.req.json();

      const delivery = await kv.get(`delivery:${deliveryId}`);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      if (delivery.deliveryPartnerId !== partnerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Verify OTP
      if (otp !== delivery.pickupOtp) {
        return sendError(c, 'Invalid OTP', 400);
      }

      // Update status
      delivery.status = 'picked_up';
      delivery.pickedUpAt = new Date().toISOString();

      await kv.set(`delivery:${deliveryId}`, delivery);

      console.log(`✅ Delivery ${deliveryId} picked up by ${partnerId}`);

      // TODO: Send notification to customer

      return sendSuccess(c, { delivery, message: 'Delivery picked up successfully' });

    } catch (error) {
      console.error('❌ Error marking pickup:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /delivery-partner/:partnerId/delivery/:deliveryId/deliver
   * Mark delivery as completed
   */
  app.put(`${BASE_PATH}/delivery-partner/:partnerId/delivery/:deliveryId/deliver`, async (c) => {
    try {
      const { partnerId, deliveryId } = c.req.param();
      const { otp } = await c.req.json();

      const delivery = await kv.get(`delivery:${deliveryId}`);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      if (delivery.deliveryPartnerId !== partnerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Verify OTP
      if (otp !== delivery.deliveryOtp) {
        return sendError(c, 'Invalid OTP', 400);
      }

      // Update status
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date().toISOString();

      await kv.set(`delivery:${deliveryId}`, delivery);

      console.log(`✅ Delivery ${deliveryId} completed by ${partnerId}`);

      // Update delivery partner stats
      const staff = await kv.get(`staff:${partnerId}`);
      if (staff) {
        staff.totalDeliveries = (staff.totalDeliveries || 0) + 1;
        staff.availability = 'available';
        await kv.set(`staff:${partnerId}`, staff);
      }

      // TODO: Send notification to customer
      // TODO: Send notification to vendor
      // TODO: Process payment settlement

      return sendSuccess(c, { delivery, message: 'Delivery completed successfully' });

    } catch (error) {
      console.error('❌ Error completing delivery:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /delivery-partner/:partnerId/location
   * Update GPS location
   */
  app.put(`${BASE_PATH}/delivery-partner/:partnerId/location`, async (c) => {
    try {
      const { partnerId } = c.req.param();
      const { lat, lng } = await c.req.json();

      const staff = await kv.get(`staff:${partnerId}`);

      if (!staff) {
        return sendError(c, 'Delivery partner not found', 404);
      }

      // Update location
      staff.currentLocation = {
        lat,
        lng,
        timestamp: new Date().toISOString()
      };

      await kv.set(`staff:${partnerId}`, staff);

      return sendSuccess(c, { message: 'Location updated' });

    } catch (error) {
      console.error('❌ Error updating location:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Hyperlocal Delivery Endpoints registered');
}
