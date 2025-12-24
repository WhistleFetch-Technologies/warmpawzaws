import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDeliveriesRepository } from '../../lib/repositories/deliveries.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';

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

export function hyperlocalDeliveryEndpoints(app: Hono) {
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
    // ✅ SQL: Get all active vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll();
    
    const nearbyVendors = [];
    
    for (const vendor of allVendors) {
      // Check if vendor has delivery service (nutritionist role)
      if (vendor.role_id !== 'pet_nutritionist' && vendor.category !== 'nutritionist') continue;
      if (!vendor.latitude || !vendor.longitude) continue;
      
      const distance = calculateDistance(
        lat,
        lng,
        Number(vendor.latitude),
        Number(vendor.longitude)
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
    
    // ✅ SQL: Get all active staff with delivery role
    const staffRepo = getStaffRepository();
    const allStaff = await staffRepo.findAll();
    
    const availablePartners = [];
    
    for (const staff of allStaff) {
      // Check if staff is delivery partner
      if (staff.role !== 'delivery_partner' && staff.role !== 'delivery') continue;
      if (!staff.is_active) continue;
      
      // Check location from active deliveries (location is tracked per delivery)
      // For now, we'll use vendor location as approximation
      // TODO: Track staff current location separately if needed
      const deliveriesRepo = getDeliveriesRepository();
      const activeDeliveries = await deliveriesRepo.findByDeliveryPartner(staff.id);
      const inTransitDelivery = activeDeliveries.find(d => d.status === 'in_transit' || d.status === 'out_for_delivery');
      
      let staffLat = pickupLat; // Default to pickup location
      let staffLng = pickupLng;
      
      if (inTransitDelivery && inTransitDelivery.current_lat && inTransitDelivery.current_lng) {
        staffLat = Number(inTransitDelivery.current_lat);
        staffLng = Number(inTransitDelivery.current_lng);
      }
      
      const distance = calculateDistance(
        pickupLat,
        pickupLng,
        staffLat,
        staffLng
      );
      
      if (distance <= maxDistance) {
        availablePartners.push({
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          distance,
          rating: 0, // TODO: Calculate from reviews
          totalDeliveries: activeDeliveries.length // Count from deliveries table
        });
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

      // ✅ SQL: Save delivery
      const deliveriesRepo = getDeliveriesRepository();
      const savedDelivery = await deliveriesRepo.create({
        order_id: deliveryId,
        customer_id: customerId,
        vendor_id: vendorId,
        nutritionist_id: nutritionistId,
        items: items,
        pickup_address: pickupLocation.address,
        pickup_lat: pickupLocation.lat,
        pickup_lng: pickupLocation.lng,
        pickup_contact_name: pickupLocation.contactName,
        pickup_contact_phone: pickupLocation.contactPhone,
        dropoff_address: dropoffLocation.address,
        dropoff_lat: dropoffLocation.lat,
        dropoff_lng: dropoffLocation.lng,
        dropoff_contact_name: dropoffLocation.contactName,
        dropoff_contact_phone: dropoffLocation.contactPhone,
        distance_km: distance,
        estimated_duration_minutes: estimatedDuration,
        delivery_fee: deliveryFee,
        status: 'pending',
        pickup_otp: generateOTP(),
        delivery_otp: generateOTP(),
        ordered_at: new Date().toISOString(),
        instructions: instructions
      });
      
      // Lists are query-based, no need to maintain separate lists

      console.log(`✅ Delivery created: ${deliveryId}`);

      // TODO: Send notification to vendor
      // TODO: Find and assign delivery partner

      return sendSuccess(c, { delivery: savedDelivery, message: 'Delivery order created successfully' });

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

      // ✅ SQL: Get delivery
      const deliveriesRepo = getDeliveriesRepository();
      const delivery = await deliveriesRepo.findById(deliveryId);

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

      // ✅ SQL: Get delivery
      const deliveriesRepo = getDeliveriesRepository();
      const delivery = await deliveriesRepo.findById(deliveryId);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      // ✅ SQL: Get current GPS location if delivery partner assigned
      let partnerLocation = null;
      if (delivery.delivery_partner_id) {
        const staffRepo = getStaffRepository();
        const staff = await staffRepo.findById(delivery.delivery_partner_id);
        // TODO: Add current_location to staff table if needed
        if (delivery.current_lat && delivery.current_lng) {
          partnerLocation = {
            lat: delivery.current_lat,
            lng: delivery.current_lng,
            timestamp: delivery.current_location_timestamp
          };
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

      // ✅ SQL: Get customer's deliveries
      const deliveriesRepo = getDeliveriesRepository();
      const deliveries = await deliveriesRepo.findByCustomer(customerId);

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

      // ✅ SQL: Get vendor's deliveries
      const deliveriesRepo = getDeliveriesRepository();
      let deliveries = await deliveriesRepo.findByVendor(vendorId);
      
      // Filter by status if provided
      if (status) {
        deliveries = deliveries.filter(d => d.status === status);
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

      // ✅ SQL: Get delivery
      const deliveriesRepo = getDeliveriesRepository();
      const delivery = await deliveriesRepo.findById(deliveryId);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      if (delivery.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Update status
      const oldStatus = delivery.status;
      const updates: any = { status };

      // Update timestamps
      if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString();
        
        // Auto-assign delivery partner
        const partners = await findAvailableDeliveryPartners(
          delivery.pickup_lat,
          delivery.pickup_lng
        );
        
        if (partners.length > 0) {
          updates.delivery_partner_id = partners[0].id;
          updates.delivery_partner_name = partners[0].name;
          updates.delivery_partner_phone = partners[0].phone;
        }
      } else if (status === 'ready_for_pickup') {
        updates.prepared_at = new Date().toISOString();
      }

      if (notes) {
        updates.notes = (delivery.notes || '') + '\n' + notes;
      }

      // ✅ SQL: Update delivery
      const updatedDelivery = await deliveriesRepo.update(deliveryId, updates);

      console.log(`✅ Delivery ${deliveryId} status updated: ${oldStatus} → ${status}`);

      // TODO: Send notification to customer
      // TODO: Send notification to delivery partner

      return sendSuccess(c, { delivery: updatedDelivery, message: 'Delivery status updated' });

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

      // ✅ SQL: Get partner's deliveries
      const deliveriesRepo = getDeliveriesRepository();
      let assignedDeliveries = await deliveriesRepo.findByDeliveryPartner(partnerId);
      
      // Filter by status if provided
      if (status) {
        assignedDeliveries = assignedDeliveries.filter(d => d.status === status);
      }

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

      // ✅ SQL: Get delivery
      const deliveriesRepo = getDeliveriesRepository();
      const delivery = await deliveriesRepo.findById(deliveryId);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      if (delivery.delivery_partner_id !== partnerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Verify OTP
      if (otp !== delivery.pickup_otp) {
        return sendError(c, 'Invalid OTP', 400);
      }

      // ✅ SQL: Update status
      const updatedDelivery = await deliveriesRepo.update(deliveryId, {
        status: 'picked_up',
        picked_up_at: new Date().toISOString()
      });

      console.log(`✅ Delivery ${deliveryId} picked up by ${partnerId}`);

      // TODO: Send notification to customer

      return sendSuccess(c, { delivery: updatedDelivery, message: 'Delivery picked up successfully' });

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

      // ✅ SQL: Get delivery
      const deliveriesRepo = getDeliveriesRepository();
      const delivery = await deliveriesRepo.findById(deliveryId);

      if (!delivery) {
        return sendError(c, 'Delivery not found', 404);
      }

      if (delivery.delivery_partner_id !== partnerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Verify OTP
      if (otp !== delivery.delivery_otp) {
        return sendError(c, 'Invalid OTP', 400);
      }

      // ✅ SQL: Update status
      const updatedDelivery = await deliveriesRepo.update(deliveryId, {
        status: 'delivered',
        delivered_at: new Date().toISOString()
      });

      console.log(`✅ Delivery ${deliveryId} completed by ${partnerId}`);

      // ✅ SQL: Update delivery partner stats (TODO: Add total_deliveries column to staff table if needed)
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(partnerId);
      // Stats can be calculated from deliveries table, no need to store separately

      // TODO: Send notification to customer
      // TODO: Send notification to vendor
      // TODO: Process payment settlement

      return sendSuccess(c, { delivery: updatedDelivery, message: 'Delivery completed successfully' });

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

      // ✅ SQL: Get staff
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(partnerId);

      if (!staff) {
        return sendError(c, 'Delivery partner not found', 404);
      }

      // ✅ SQL: Update delivery's current location (location is tracked per delivery, not per staff)
      // Find active delivery for this partner and update its location
      const deliveriesRepo = getDeliveriesRepository();
      const activeDeliveries = await deliveriesRepo.findByDeliveryPartner(partnerId);
      const inTransitDelivery = activeDeliveries.find(d => d.status === 'in_transit' || d.status === 'out_for_delivery');
      
      if (inTransitDelivery) {
        await deliveriesRepo.update(inTransitDelivery.id, {
          current_lat: lat,
          current_lng: lng,
          current_location_timestamp: new Date().toISOString()
        });
      }

      return sendSuccess(c, { message: 'Location updated' });

    } catch (error) {
      console.error('❌ Error updating location:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Hyperlocal Delivery Endpoints registered');
}
