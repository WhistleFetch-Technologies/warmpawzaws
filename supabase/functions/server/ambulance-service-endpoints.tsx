import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🚑 AMBULANCE SERVICE ENDPOINTS
 * 
 * Complete ambulance booking and tracking system for Warmpawz
 * 
 * Features:
 * - Emergency ambulance booking
 * - Real-time GPS tracking
 * - Nearest ambulance assignment
 * - Driver communication
 * - Booking lifecycle management
 * - Emergency notifications
 * 
 * Booking States:
 * - pending: Waiting for assignment
 * - assigned: Driver assigned
 * - en_route: On the way
 * - arrived: Reached pickup location
 * - transporting: Pet in ambulance
 * - completed: Reached destination
 * - cancelled: Booking cancelled
 */

interface AmbulanceBooking {
  bookingId: string;
  customerId: string;
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
  vendorId?: string;
  status: 'pending' | 'assigned' | 'en_route' | 'arrived' | 'transporting' | 'completed' | 'cancelled';
  estimatedArrivalTime?: string;
  actualPickupTime?: string;
  actualDropTime?: string;
  fare?: number;
  distance?: number; // in km
  tracking: {
    currentLocation?: { lat: number; lng: number };
    lastUpdated?: string;
    route?: Array<{ lat: number; lng: number }>;
  };
  createdAt: string;
  updatedAt: string;
}

interface AmbulanceVehicle {
  ambulanceId: string;
  vendorId: string;
  vehicleNumber: string;
  vehicleType: 'basic' | 'advanced' | 'icu';
  capacity: number; // number of pets
  equipment: string[];
  isAvailable: boolean;
  currentLocation?: { lat: number; lng: number };
  driverId?: string;
  rating: number;
  totalTrips: number;
  createdAt: string;
}

interface AmbulanceDriver {
  driverId: string;
  vendorId: string;
  name: string;
  phone: string;
  licenseNumber: string;
  isAvailable: boolean;
  currentLocation?: { lat: number; lng: number };
  currentBookingId?: string;
  rating: number;
  totalTrips: number;
  specialization: string[];
  createdAt: string;
}

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
  if (vehicleType === 'icu') {
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
  kv: any,
  pickupLat: number,
  pickupLng: number,
  emergencyType: string
): Promise<{ ambulance: AmbulanceVehicle; driver: AmbulanceDriver; distance: number } | null> {
  // Get all available ambulances
  const ambulances = await kv.getByPrefix('ambulance:vehicle:') || [];
  const drivers = await kv.getByPrefix('ambulance:driver:') || [];

  const availableAmbulances: Array<{
    ambulance: AmbulanceVehicle;
    driver: AmbulanceDriver;
    distance: number;
  }> = [];

  for (const ambItem of ambulances) {
    const ambulance = ambItem.value || ambItem;
    
    if (!ambulance.isAvailable || !ambulance.currentLocation) continue;

    // Find assigned driver
    const driver = drivers.find((d: any) => {
      const driverData = d.value || d;
      return driverData.driverId === ambulance.driverId && driverData.isAvailable;
    });

    if (!driver) continue;

    const driverData = driver.value || driver;

    // Calculate distance
    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      ambulance.currentLocation.lat,
      ambulance.currentLocation.lng
    );

    // For critical emergencies, only consider ambulances within 10km
    if (emergencyType === 'critical' && distance > 10) continue;

    availableAmbulances.push({
      ambulance,
      driver: driverData,
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
  kv: any,
  customerId: string,
  bookingId: string,
  type: string,
  message: string
) {
  const notification = {
    notificationId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: customerId,
    type: 'emergency',
    category: type,
    title: 'Ambulance Update',
    message,
    data: { bookingId },
    isRead: false,
    createdAt: new Date().toISOString()
  };

  await kv.set(`notification:${notification.notificationId}`, notification);
  
  // Also send SMS if configured
  try {
    const customer = await kv.get(`customer:${customerId}`);
    if (customer?.phone) {
      // SMS sending logic would go here
      console.log(`📱 SMS to ${customer.phone}: ${message}`);
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

export function ambulanceServiceEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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
        kv,
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

      const fare = calculateFare(totalDistance, emergencyType, ambulance.vehicleType);

      // Estimate arrival time (assuming 30 km/h average speed)
      const estimatedMinutes = Math.ceil((distance / 30) * 60);
      const estimatedArrivalTime = new Date(Date.now() + estimatedMinutes * 60000).toISOString();

      // Create booking
      const bookingId = `AMB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const booking: AmbulanceBooking = {
        bookingId,
        customerId,
        petId,
        petName,
        emergencyType,
        pickupLocation,
        dropLocation,
        symptoms,
        specialRequirements,
        ambulanceId: ambulance.ambulanceId,
        driverId: driver.driverId,
        vendorId: ambulance.vendorId,
        status: 'assigned',
        estimatedArrivalTime,
        fare,
        distance: totalDistance,
        tracking: {
          currentLocation: ambulance.currentLocation,
          lastUpdated: new Date().toISOString(),
          route: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`ambulance:booking:${bookingId}`, booking);

      // Update ambulance and driver status
      ambulance.isAvailable = false;
      ambulance.currentBookingId = bookingId;
      await kv.set(`ambulance:vehicle:${ambulance.ambulanceId}`, ambulance);

      driver.isAvailable = false;
      driver.currentBookingId = bookingId;
      await kv.set(`ambulance:driver:${driver.driverId}`, driver);

      // Send notifications
      await sendEmergencyNotification(
        kv,
        customerId,
        bookingId,
        'booking_confirmed',
        `Ambulance assigned! Driver ${driver.name} will reach you in approximately ${estimatedMinutes} minutes.`
      );

      console.log(`✅ Ambulance booking created: ${bookingId}`);

      return sendSuccess(c, {
        booking: {
          bookingId,
          status: 'assigned',
          estimatedArrivalTime,
          fare,
          distance: totalDistance
        },
        ambulance: {
          vehicleNumber: ambulance.vehicleNumber,
          vehicleType: ambulance.vehicleType,
          equipment: ambulance.equipment
        },
        driver: {
          name: driver.name,
          phone: driver.phone,
          rating: driver.rating
        },
        tracking: {
          currentLocation: ambulance.currentLocation,
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

      const booking = await kv.get(`ambulance:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get ambulance and driver details
      const ambulance = booking.ambulanceId 
        ? await kv.get(`ambulance:vehicle:${booking.ambulanceId}`)
        : null;
      
      const driver = booking.driverId
        ? await kv.get(`ambulance:driver:${booking.driverId}`)
        : null;

      return sendSuccess(c, {
        booking,
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

      const booking = await kv.get(`ambulance:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Calculate ETA based on current location
      let eta = null;
      if (booking.tracking.currentLocation && booking.status !== 'completed') {
        const targetLocation = booking.status === 'assigned' || booking.status === 'en_route'
          ? booking.pickupLocation
          : booking.dropLocation;

        const remainingDistance = calculateDistance(
          booking.tracking.currentLocation.lat,
          booking.tracking.currentLocation.lng,
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
        status: booking.status,
        currentLocation: booking.tracking.currentLocation,
        route: booking.tracking.route,
        lastUpdated: booking.tracking.lastUpdated,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
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

      const booking = await kv.get(`ambulance:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.driverId !== driverId) {
        return sendError(c, 'Unauthorized: Driver mismatch', 403);
      }

      // Update tracking
      booking.tracking.currentLocation = { lat, lng };
      booking.tracking.lastUpdated = new Date().toISOString();
      
      // Add to route history
      if (!booking.tracking.route) booking.tracking.route = [];
      booking.tracking.route.push({ lat, lng });

      // Keep only last 100 points to avoid bloat
      if (booking.tracking.route.length > 100) {
        booking.tracking.route = booking.tracking.route.slice(-100);
      }

      booking.updatedAt = new Date().toISOString();

      await kv.set(`ambulance:booking:${bookingId}`, booking);

      // Update driver location
      const driver = await kv.get(`ambulance:driver:${driverId}`);
      if (driver) {
        driver.currentLocation = { lat, lng };
        await kv.set(`ambulance:driver:${driverId}`, driver);
      }

      return sendSuccess(c, { 
        updated: true, 
        location: { lat, lng },
        timestamp: booking.tracking.lastUpdated
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

      const booking = await kv.get(`ambulance:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.driverId !== driverId) {
        return sendError(c, 'Unauthorized: Driver mismatch', 403);
      }

      const oldStatus = booking.status;
      booking.status = status;
      booking.updatedAt = new Date().toISOString();

      // Update timestamps
      if (status === 'arrived' && !booking.actualPickupTime) {
        booking.actualPickupTime = new Date().toISOString();
      } else if (status === 'completed') {
        booking.actualDropTime = new Date().toISOString();
        
        // Mark ambulance and driver as available
        if (booking.ambulanceId) {
          const ambulance = await kv.get(`ambulance:vehicle:${booking.ambulanceId}`);
          if (ambulance) {
            ambulance.isAvailable = true;
            ambulance.currentBookingId = null;
            ambulance.totalTrips = (ambulance.totalTrips || 0) + 1;
            await kv.set(`ambulance:vehicle:${booking.ambulanceId}`, ambulance);
          }
        }

        if (booking.driverId) {
          const driver = await kv.get(`ambulance:driver:${booking.driverId}`);
          if (driver) {
            driver.isAvailable = true;
            driver.currentBookingId = null;
            driver.totalTrips = (driver.totalTrips || 0) + 1;
            await kv.set(`ambulance:driver:${booking.driverId}`, driver);
          }
        }
      }

      await kv.set(`ambulance:booking:${bookingId}`, booking);

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
          kv,
          booking.customerId,
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
        updatedAt: booking.updatedAt
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

      const ambulances = await kv.getByPrefix('ambulance:vehicle:') || [];
      const nearbyAmbulances: any[] = [];

      for (const item of ambulances) {
        const ambulance = item.value || item;
        
        if (!ambulance.currentLocation) continue;

        const distance = calculateDistance(
          lat,
          lng,
          ambulance.currentLocation.lat,
          ambulance.currentLocation.lng
        );

        if (distance <= radius) {
          nearbyAmbulances.push({
            ...ambulance,
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

      const allBookings = await kv.getByPrefix('ambulance:booking:') || [];
      
      let customerBookings = allBookings
        .map((item: any) => item.value || item)
        .filter((booking: any) => booking.customerId === customerId);

      if (status) {
        customerBookings = customerBookings.filter((b: any) => b.status === status);
      }

      // Sort by creation date (newest first)
      customerBookings.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        customerId,
        count: customerBookings.length,
        bookings: customerBookings
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

      const ambulanceId = `AMB-VEH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const ambulance: AmbulanceVehicle = {
        ambulanceId,
        vendorId,
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleType,
        capacity,
        equipment,
        isAvailable: true,
        currentLocation,
        rating: 5.0,
        totalTrips: 0,
        createdAt: new Date().toISOString()
      };

      await kv.set(`ambulance:vehicle:${ambulanceId}`, ambulance);

      console.log(`✅ Ambulance registered: ${ambulanceId}`);

      return sendSuccess(c, { ambulance }, 'Ambulance registered successfully');

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

      const driver: AmbulanceDriver = {
        driverId,
        vendorId,
        name,
        phone,
        licenseNumber: licenseNumber.toUpperCase(),
        isAvailable: true,
        currentLocation,
        rating: 5.0,
        totalTrips: 0,
        specialization,
        createdAt: new Date().toISOString()
      };

      await kv.set(`ambulance:driver:${driverId}`, driver);

      console.log(`✅ Driver registered: ${driverId}`);

      return sendSuccess(c, { driver }, 'Driver registered successfully');

    } catch (error) {
      console.error('❌ Error registering driver:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Ambulance Service Endpoints registered');
}
