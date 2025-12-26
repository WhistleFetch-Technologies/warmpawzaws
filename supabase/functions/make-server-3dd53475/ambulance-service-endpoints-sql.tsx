/**
 * ============================================================================
 * AMBULANCE SERVICE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete ambulance booking and tracking system for Warmpawz
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Ambulance bookings stored in `bookings` table with `service_type = 'ambulance'`
 * - Ambulance-specific data stored in `service_address` JSONB field
 * - Vehicles stored in `ambulance_vehicles` table
 * - Drivers stored in `ambulance_drivers` table
 * 
 * Date: 2024-12-24
 * Migration: Phase 2 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getAmbulanceVehiclesRepository } from "../../lib/repositories/ambulance-vehicles.ts";
import { getAmbulanceDriversRepository } from "../../lib/repositories/ambulance-drivers.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getDbClient } from "../../lib/db.ts";

// ============================================================================
// TYPES
// ============================================================================

interface AmbulanceBookingData {
  bookingId: string;
  petId: string;
  petName: string;
  emergencyType: 'critical' | 'urgent' | 'scheduled';
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    pincode: string;
  };
  dropLocation: {
    lat: number;
    lng: number;
    address: string;
    facilityName?: string;
  };
  symptoms?: string;
  specialRequirements?: string;
  ambulanceId?: string;
  driverId?: string;
  estimatedArrivalTime?: string;
  actualPickupTime?: string;
  actualDropTime?: string;
  fare?: number;
  distance?: number;
  tracking: {
    currentLocation?: { lat: number; lng: number };
    lastUpdated?: string;
    route?: Array<{ lat: number; lng: number }>;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate fare based on distance and emergency type
function calculateFare(distance: number, emergencyType: string, vehicleType: string): number {
  let baseFare = 200; // Base fare in INR
  let perKmRate = 15;

  // Emergency surcharge
  if (emergencyType === 'critical') {
    baseFare += 300;
    perKmRate += 10;
  } else if (emergencyType === 'urgent') {
    baseFare += 150;
    perKmRate += 5;
  }

  // Vehicle type surcharge
  if (vehicleType === 'critical_care') {
    baseFare += 500;
    perKmRate += 20;
  } else if (vehicleType === 'advanced') {
    baseFare += 200;
    perKmRate += 10;
  }

  return baseFare + (distance * perKmRate);
}

// Find nearest available ambulance
async function findNearestAmbulance(
  pickupLat: number,
  pickupLng: number,
  emergencyType: string
): Promise<{ ambulance: any; driver: any; distance: number } | null> {
  const vehiclesRepo = getAmbulanceVehiclesRepository();
  const driversRepo = getAmbulanceDriversRepository();

  // Get all available ambulances
  const allVehicles = await vehiclesRepo.findAll();
  const allDrivers = await driversRepo.findAll();

  const availableAmbulances: Array<{
    ambulance: any;
    driver: any;
    distance: number;
  }> = [];

  for (const ambulance of allVehicles) {
    if (!ambulance.is_available || !ambulance.current_location) continue;

    // Find assigned driver (check if vehicle has driver_id in metadata or find available driver)
    const availableDrivers = allDrivers.filter(d => 
      d.is_available && d.vendor_id === ambulance.vendor_id
    );

    if (availableDrivers.length === 0) continue;

    // Use first available driver for this vendor
    const driver = availableDrivers[0];

    // Calculate distance
    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      ambulance.current_location.lat,
      ambulance.current_location.lng
    );

    // For critical emergencies, only consider ambulances within 10km
    if (emergencyType === 'critical' && distance > 10) continue;

    availableAmbulances.push({
      ambulance,
      driver,
      distance
    });
  }

  if (availableAmbulances.length === 0) return null;

  // Sort by distance
  availableAmbulances.sort((a, b) => a.distance - b.distance);

  return availableAmbulances[0];
}

// Send emergency notification
async function sendEmergencyNotification(
  customerId: string,
  bookingId: string,
  type: string,
  message: string
) {
  const notificationsRepo = getNotificationsRepository();
  
  // Get customer to find user_id
  const customersRepo = getCustomersRepository();
  const customer = await customersRepo.findById(customerId);
  
  if (customer?.user_id) {
    await notificationsRepo.create({
      user_id: customer.user_id,
      notification_type: 'emergency',
      title: 'Ambulance Update',
      message,
      data: { bookingId, category: type }
    });
  }
  
  // Also send SMS if configured
  try {
    if (customer?.phone) {
      // SMS sending logic would go here
      console.log(`📱 SMS to ${customer.phone}: ${message}`);
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function ambulanceServiceEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const vehiclesRepo = getAmbulanceVehiclesRepository();
  const driversRepo = getAmbulanceDriversRepository();
  const bookingsRepo = getBookingsRepository();
  const db = getDbClient();

  // ============================================
  // FLEET MANAGEMENT ENDPOINTS (VENDOR UI)
  // ============================================

  /**
   * GET /vendor/:vendorId/ambulance/vehicles
   * Get all ambulance vehicles for a vendor
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/ambulance/vehicles`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vehicles = await vehiclesRepo.findByVendor(vendorId);
      
      // Map to API format
      const mappedVehicles = vehicles.map(v => ({
        id: v.id,
        ambulanceId: v.id,
        vendorId: v.vendor_id,
        vehicleNumber: v.vehicle_number,
        vehicleType: v.vehicle_type,
        capacity: v.capacity,
        equipment: v.equipment,
        isAvailable: v.is_available,
        currentLocation: v.current_location,
        rating: v.rating,
        totalTrips: v.total_trips,
        createdAt: v.created_at
      }));
      
      return sendSuccess(c, { vehicles: mappedVehicles, total: mappedVehicles.length });
    } catch (error) {
      console.error('Error fetching ambulance vehicles:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/ambulance/vehicles
   * Add a new ambulance vehicle
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/ambulance/vehicles`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vehicleData = await c.req.json();
      
      const vehicle = await vehiclesRepo.create({
        vendor_id: vendorId,
        vehicle_number: vehicleData.vehicleNumber || vehicleData.vehicle_number,
        vehicle_type: vehicleData.vehicleType || vehicleData.vehicle_type || 'basic',
        capacity: vehicleData.capacity || 2,
        equipment: vehicleData.equipment || [],
        current_location: vehicleData.currentLocation || vehicleData.current_location,
        is_available: true
      });
      
      return sendSuccess(c, { 
        vehicle: {
          id: vehicle.id,
          ambulanceId: vehicle.id,
          ...vehicle
        }
      }, 'Vehicle added successfully');
    } catch (error) {
      console.error('Error adding ambulance vehicle:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /ambulance/emergency/create
   * Create emergency ambulance booking
   */
  app.post(`${BASE_PATH}/ambulance/emergency/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        petId,
        petName,
        emergencyType = 'urgent',
        pickupLocation,
        dropLocation,
        symptoms,
        specialRequirements
      } = body;

      // Validation
      if (!customerId || !petId || !pickupLocation || !dropLocation) {
        return sendError(c, 'Missing required fields: customerId, petId, pickupLocation, dropLocation', 400);
      }

      if (!pickupLocation.lat || !pickupLocation.lng) {
        return sendError(c, 'Invalid pickup location coordinates', 400);
      }

      if (!dropLocation.lat || !dropLocation.lng) {
        return sendError(c, 'Invalid drop location coordinates', 400);
      }

      console.log(`🚑 Emergency ambulance request for pet: ${petName}`);

      // Find nearest available ambulance
      const nearest = await findNearestAmbulance(
        pickupLocation.lat,
        pickupLocation.lng,
        emergencyType
      );

      if (!nearest) {
        console.warn('⚠️ No ambulances available');
        return sendError(c, 'No ambulances available at the moment. Please try again or contact support.', 503);
      }

      const { ambulance, driver, distance } = nearest;

      // Calculate fare
      const totalDistance = calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        dropLocation.lat,
        dropLocation.lng
      ) + distance; // pickup distance + transport distance

      const fare = calculateFare(totalDistance, emergencyType, ambulance.vehicle_type);

      // Estimate arrival time (assuming 30 km/h average speed)
      const estimatedMinutes = Math.ceil((distance / 30) * 60);
      const estimatedArrivalTime = new Date(Date.now() + estimatedMinutes * 60000).toISOString();

      // Create booking ID
      const bookingId = `AMB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Store ambulance-specific data in service_address JSONB
      const ambulanceData: AmbulanceBookingData = {
        bookingId,
        petId,
        petName,
        emergencyType,
        pickupLocation,
        dropLocation,
        symptoms,
        specialRequirements,
        ambulanceId: ambulance.id,
        driverId: driver.driver_id,
        estimatedArrivalTime,
        fare,
        distance: totalDistance,
        tracking: {
          currentLocation: ambulance.current_location,
          lastUpdated: new Date().toISOString(),
          route: []
        }
      };

      // Get or create ambulance service for this vendor
      // Query for ambulance service in services table
      let serviceId: string | null = null;
      
      // Try to find ambulance service for this vendor
      const { data: vendorService } = await db
        .from('services')
        .select('id')
        .eq('vendor_id', ambulance.vendor_id)
        .ilike('name', '%ambulance%')
        .maybeSingle();
      
      if (vendorService?.id) {
        serviceId = vendorService.id;
      } else {
        // Try to find any ambulance service
        const { data: anyService } = await db
          .from('services')
          .select('id')
          .ilike('name', '%ambulance%')
          .limit(1)
          .maybeSingle();
        
        if (anyService?.id) {
          serviceId = anyService.id;
        } else {
          // Create a default ambulance service for this vendor
          const { data: newService, error: serviceError } = await db
            .from('services')
            .insert({
              vendor_id: ambulance.vendor_id,
              service_id: `ambulance_${Date.now()}`,
              name: 'Emergency Ambulance Service',
              description: 'Emergency ambulance transportation for pets',
              category: 'emergency',
              service_type: 'ambulance',
              base_price: fare,
              duration_minutes: 60,
              is_active: true
            })
            .select('id')
            .single();
          
          if (serviceError || !newService) {
            console.error('Failed to create ambulance service:', serviceError);
            // Use a fallback UUID (this should be handled better in production)
            serviceId = '00000000-0000-0000-0000-000000000001';
          } else {
            serviceId = newService.id;
          }
        }
      }

      // Create booking in SQL
      // Store ambulance-specific data in notes JSONB field
      // Use direct DB insert to set booking_id field
      const { data: bookingData, error: bookingError } = await db
        .from('bookings')
        .insert({
          booking_id: bookingId, // Set the ambulance booking ID
          customer_id: customerId,
          vendor_id: ambulance.vendor_id,
          staff_id: null, // Driver is separate from staff
          service_id: serviceId,
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
          service_type: 'ambulance',
          service_style: 'at_home', // Ambulance is home service
          address: pickupLocation.address,
          city: pickupLocation.city,
          pincode: pickupLocation.pincode,
          latitude: pickupLocation.lat,
          longitude: pickupLocation.lng,
          amount: fare,
          base_price: fare,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: fare,
          payment_status: 'pending',
          status: 'assigned', // Ambulance is immediately assigned
          notes: JSON.stringify(ambulanceData) // Store ambulance data in notes
        })
        .select()
        .single();

      if (bookingError || !bookingData) {
        throw new Error(`Failed to create booking: ${bookingError?.message || 'Unknown error'}`);
      }

      const booking = bookingData;

      // Update ambulance and driver status
      await vehiclesRepo.update(ambulance.id, {
        is_available: false,
        current_location: ambulance.current_location
      });

      await driversRepo.update(driver.driver_id, {
        is_available: false,
        current_booking_id: booking.id
      });

      // Send notifications
      await sendEmergencyNotification(
        customerId,
        bookingId,
        'booking_confirmed',
        `Ambulance assigned! Driver ${driver.name} will reach you in approximately ${estimatedMinutes} minutes.`
      );

      console.log(`✅ Ambulance booking created: ${bookingId}`);

      return sendSuccess(c, {
        booking: {
          bookingId,
          id: booking.id,
          status: 'assigned',
          estimatedArrivalTime,
          fare,
          distance: totalDistance
        },
        ambulance: {
          vehicleNumber: ambulance.vehicle_number,
          vehicleType: ambulance.vehicle_type,
          equipment: ambulance.equipment
        },
        driver: {
          name: driver.name,
          phone: driver.phone,
          rating: driver.rating
        },
        tracking: {
          currentLocation: ambulance.current_location,
          estimatedMinutes
        }
      }, 'Ambulance booking created successfully');

    } catch (error) {
      console.error('❌ Error creating ambulance booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /ambulance/booking/:bookingId
   * Get ambulance booking details
   */
  app.get(`${BASE_PATH}/ambulance/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Find booking by booking_id field
      const { data: bookingData } = await db
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (!bookingData) {
        return sendError(c, 'Booking not found', 404);
      }

      // Parse ambulance data from notes
      let ambulanceData: AmbulanceBookingData | null = null;
      try {
        ambulanceData = JSON.parse(bookingData.notes || '{}');
      } catch (e) {
        // If notes is not JSON, it's not an ambulance booking
      }

      if (!ambulanceData || !ambulanceData.ambulanceId) {
        return sendError(c, 'Not an ambulance booking', 400);
      }

      // Get ambulance and driver details
      const ambulance = ambulanceData.ambulanceId 
        ? await vehiclesRepo.findById(ambulanceData.ambulanceId)
        : null;
      
      const driver = ambulanceData.driverId
        ? await driversRepo.findByDriverId(ambulanceData.driverId)
        : null;

      return sendSuccess(c, {
        booking: bookingData,
        ambulanceData,
        ambulance,
        driver
      });

    } catch (error) {
      console.error('❌ Error fetching booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /ambulance/track/:bookingId
   * Get real-time tracking information
   */
  app.get(`${BASE_PATH}/ambulance/track/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Find booking
      const { data: bookingData } = await db
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (!bookingData) {
        return sendError(c, 'Booking not found', 404);
      }

      // Parse ambulance data
      let ambulanceData: AmbulanceBookingData | null = null;
      try {
        ambulanceData = JSON.parse(bookingData.notes || '{}');
      } catch (e) {
        return sendError(c, 'Not an ambulance booking', 400);
      }

      if (!ambulanceData) {
        return sendError(c, 'Invalid booking data', 400);
      }

      // Calculate ETA based on current location
      let eta = null;
      if (ambulanceData.tracking.currentLocation && bookingData.status !== 'completed') {
        const targetLocation = bookingData.status === 'assigned' || bookingData.status === 'en_route'
          ? ambulanceData.pickupLocation
          : ambulanceData.dropLocation;

        const remainingDistance = calculateDistance(
          ambulanceData.tracking.currentLocation.lat,
          ambulanceData.tracking.currentLocation.lng,
          targetLocation.lat,
          targetLocation.lng
        );

        const etaMinutes = Math.ceil((remainingDistance / 30) * 60);
        eta = {
          minutes: etaMinutes,
          arrival: new Date(Date.now() + etaMinutes * 60000).toISOString()
        };
      }

      return sendSuccess(c, {
        bookingId,
        status: bookingData.status,
        currentLocation: ambulanceData.tracking.currentLocation,
        route: ambulanceData.tracking.route,
        lastUpdated: ambulanceData.tracking.lastUpdated,
        pickupLocation: ambulanceData.pickupLocation,
        dropLocation: ambulanceData.dropLocation,
        eta
      });

    } catch (error) {
      console.error('❌ Error tracking booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /ambulance/update-location
   * Update ambulance location (called by driver app)
   */
  app.post(`${BASE_PATH}/ambulance/update-location`, async (c) => {
    try {
      const body = await c.req.json();
      const { driverId, bookingId, lat, lng } = body;

      if (!driverId || !bookingId || !lat || !lng) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Find booking
      const { data: bookingData } = await db
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (!bookingData) {
        return sendError(c, 'Booking not found', 404);
      }

      // Parse and update ambulance data
      let ambulanceData: AmbulanceBookingData = JSON.parse(bookingData.notes || '{}');
      
      if (ambulanceData.driverId !== driverId) {
        return sendError(c, 'Unauthorized: Driver mismatch', 403);
      }

      // Update tracking
      ambulanceData.tracking.currentLocation = { lat, lng };
      ambulanceData.tracking.lastUpdated = new Date().toISOString();
      
      // Add to route history
      if (!ambulanceData.tracking.route) ambulanceData.tracking.route = [];
      ambulanceData.tracking.route.push({ lat, lng });

      // Keep only last 100 points
      if (ambulanceData.tracking.route.length > 100) {
        ambulanceData.tracking.route = ambulanceData.tracking.route.slice(-100);
      }

      // Update booking notes with new tracking data
      await bookingsRepo.update(bookingData.id, {
        notes: JSON.stringify(ambulanceData)
      });

      // Update driver location
      await driversRepo.update(driverId, {
        current_location: { lat, lng }
      });

      return sendSuccess(c, { 
        updated: true, 
        location: { lat, lng },
        timestamp: ambulanceData.tracking.lastUpdated
      });

    } catch (error) {
      console.error('❌ Error updating location:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /ambulance/update-status
   * Update booking status (called by driver app)
   */
  app.post(`${BASE_PATH}/ambulance/update-status`, async (c) => {
    try {
      const body = await c.req.json();
      const { driverId, bookingId, status } = body;

      const validStatuses = ['assigned', 'en_route', 'arrived', 'transporting', 'completed', 'cancelled'];
      
      if (!driverId || !bookingId || !status) {
        return sendError(c, 'Missing required fields', 400);
      }

      if (!validStatuses.includes(status)) {
        return sendError(c, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      // Find booking
      const { data: bookingData } = await db
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (!bookingData) {
        return sendError(c, 'Booking not found', 404);
      }

      // Parse ambulance data
      let ambulanceData: AmbulanceBookingData = JSON.parse(bookingData.notes || '{}');
      
      if (ambulanceData.driverId !== driverId) {
        return sendError(c, 'Unauthorized: Driver mismatch', 403);
      }

      const oldStatus = bookingData.status;
      
      // Update timestamps
      if (status === 'arrived' && !ambulanceData.actualPickupTime) {
        ambulanceData.actualPickupTime = new Date().toISOString();
      } else if (status === 'completed') {
        ambulanceData.actualDropTime = new Date().toISOString();
        
        // Mark ambulance and driver as available
        if (ambulanceData.ambulanceId) {
          const ambulance = await vehiclesRepo.findById(ambulanceData.ambulanceId);
          if (ambulance) {
            await vehiclesRepo.update(ambulance.id, {
              is_available: true,
              total_trips: ambulance.total_trips + 1
            });
          }
        }

        if (ambulanceData.driverId) {
          const driver = await driversRepo.findByDriverId(ambulanceData.driverId);
          if (driver) {
            await driversRepo.update(driver.driver_id, {
              is_available: true,
              current_booking_id: null,
              total_trips: driver.total_trips + 1
            });
          }
        }
      }

      // Update booking
      await bookingsRepo.update(bookingData.id, {
        status,
        notes: JSON.stringify(ambulanceData),
        completed_at: status === 'completed' ? new Date().toISOString() : undefined
      });

      // Send notification to customer
      const statusMessages: Record<string, string> = {
        'en_route': 'Your ambulance is on the way!',
        'arrived': 'Ambulance has arrived at your location',
        'transporting': 'Your pet is being transported',
        'completed': 'Your pet has been safely delivered',
        'cancelled': 'Ambulance booking has been cancelled'
      };

      if (statusMessages[status]) {
        await sendEmergencyNotification(
          bookingData.customer_id,
          bookingId,
          'status_update',
          statusMessages[status]
        );
      }

      console.log(`✅ Booking ${bookingId} status updated: ${oldStatus} → ${status}`);

      return sendSuccess(c, {
        bookingId,
        oldStatus,
        newStatus: status,
        updatedAt: new Date().toISOString()
      }, 'Status updated successfully');

    } catch (error) {
      console.error('❌ Error updating status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /ambulance/nearby
   * Get nearby ambulances
   */
  app.get(`${BASE_PATH}/ambulance/nearby`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseFloat(c.req.query('radius') || '10'); // default 10km

      if (!lat || !lng) {
        return sendError(c, 'Missing location coordinates', 400);
      }

      const allVehicles = await vehiclesRepo.findAll();
      const nearbyAmbulances: any[] = [];

      for (const ambulance of allVehicles) {
        if (!ambulance.current_location) continue;

        const distance = calculateDistance(
          lat,
          lng,
          ambulance.current_location.lat,
          ambulance.current_location.lng
        );

        if (distance <= radius) {
          nearbyAmbulances.push({
            id: ambulance.id,
            ambulanceId: ambulance.id,
            vendorId: ambulance.vendor_id,
            vehicleNumber: ambulance.vehicle_number,
            vehicleType: ambulance.vehicle_type,
            capacity: ambulance.capacity,
            equipment: ambulance.equipment,
            isAvailable: ambulance.is_available,
            currentLocation: ambulance.current_location,
            rating: ambulance.rating,
            totalTrips: ambulance.total_trips,
            distance: parseFloat(distance.toFixed(2))
          });
        }
      }

      // Sort by distance
      nearbyAmbulances.sort((a, b) => a.distance - b.distance);

      return sendSuccess(c, {
        location: { lat, lng },
        radius,
        count: nearbyAmbulances.length,
        ambulances: nearbyAmbulances
      });

    } catch (error) {
      console.error('❌ Error finding nearby ambulances:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /ambulance/customer/:customerId/bookings
   * Get customer's ambulance booking history
   */
  app.get(`${BASE_PATH}/ambulance/customer/:customerId/bookings`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      // Get all bookings for customer with service_type = 'ambulance'
      const { data: bookings } = await db
        .from('bookings')
        .select('*')
        .eq('customer_id', customerId)
        .eq('service_type', 'ambulance')
        .order('created_at', { ascending: false });

      let customerBookings = bookings || [];

      if (status) {
        customerBookings = customerBookings.filter(b => b.status === status);
      }

      // Parse ambulance data from each booking
      const mappedBookings = customerBookings.map(booking => {
        let ambulanceData: AmbulanceBookingData | null = null;
        try {
          ambulanceData = JSON.parse(booking.notes || '{}');
        } catch (e) {
          // Ignore parse errors
        }
        return {
          ...booking,
          ambulanceData
        };
      });

      return sendSuccess(c, {
        customerId,
        count: mappedBookings.length,
        bookings: mappedBookings
      });

    } catch (error) {
      console.error('❌ Error fetching customer bookings:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /ambulance/vehicle/register
   * Register new ambulance vehicle (admin/vendor)
   */
  app.post(`${BASE_PATH}/ambulance/vehicle/register`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        vehicleNumber,
        vehicleType = 'basic',
        capacity = 2,
        equipment = [],
        currentLocation
      } = body;

      if (!vendorId || !vehicleNumber) {
        return sendError(c, 'Missing required fields: vendorId, vehicleNumber', 400);
      }

      const vehicle = await vehiclesRepo.create({
        vendor_id: vendorId,
        vehicle_number: vehicleNumber.toUpperCase(),
        vehicle_type: vehicleType,
        capacity,
        equipment,
        current_location: currentLocation,
        is_available: true
      });

      console.log(`✅ Ambulance registered: ${vehicle.id}`);

      return sendSuccess(c, { 
        ambulance: {
          id: vehicle.id,
          ambulanceId: vehicle.id,
          ...vehicle
        }
      }, 'Ambulance registered successfully');

    } catch (error) {
      console.error('❌ Error registering ambulance:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /ambulance/driver/register
   * Register new ambulance driver (admin/vendor)
   */
  app.post(`${BASE_PATH}/ambulance/driver/register`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        name,
        phone,
        licenseNumber,
        specialization = [],
        currentLocation
      } = body;

      if (!vendorId || !name || !phone || !licenseNumber) {
        return sendError(c, 'Missing required fields: vendorId, name, phone, licenseNumber', 400);
      }

      const driverId = `AMB-DRV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const driver = await driversRepo.create({
        driver_id: driverId,
        vendor_id: vendorId,
        name,
        phone,
        license_number: licenseNumber.toUpperCase(),
        is_available: true,
        current_location: currentLocation,
        specialization
      });

      console.log(`✅ Driver registered: ${driverId}`);

      return sendSuccess(c, { 
        driver: {
          driverId: driver.driver_id,
          ...driver
        }
      }, 'Driver registered successfully');

    } catch (error) {
      console.error('❌ Error registering driver:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Ambulance Service Endpoints registered (SQL-only)');
}

