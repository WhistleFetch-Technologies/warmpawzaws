import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🚑 INTEGRATED SERVICES ENDPOINTS
 * 
 * Complete lifecycle for integrated services:
 * - Emergency Ambulance
 * - Diagnostics Center
 * - Medicine Delivery (already exists)
 * 
 * Features:
 * - Emergency booking
 * - GPS tracking
 * - Real-time updates
 * - Report management
 */

interface AmbulanceBooking {
  id: string;
  customerId: string;
  petId: string;
  vendorId?: string;
  
  // Emergency details
  emergencyType: 'accident' | 'illness' | 'injury' | 'other';
  severity: 'critical' | 'urgent' | 'normal';
  description: string;
  
  // Location
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
    contactName: string;
    contactPhone: string;
  };
  
  dropLocation: {
    address: string;
    lat: number;
    lng: number;
    facilityName: string;
  };
  
  // Tracking
  status: 'requested' | 'assigned' | 'en_route_to_pickup' | 'arrived' | 'pet_loaded' | 'en_route_to_facility' | 'delivered' | 'completed';
  ambulanceId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  
  // Timeline
  requestedAt: string;
  assignedAt?: string;
  arrivedAt?: string;
  loadedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  
  // Payment
  estimatedFare: number;
  actualFare?: number;
  paymentStatus: 'pending' | 'paid';
  
  notes?: string;
}

interface DiagnosticsBooking {
  id: string;
  customerId: string;
  petId: string;
  vendorId: string;
  
  // Test details
  tests: {
    testId: string;
    testName: string;
    price: number;
  }[];
  
  // Appointment
  appointmentDate: string;
  appointmentTime: string;
  serviceStyle: 'center' | 'home_collection';
  
  // Home collection details
  collectionLocation?: {
    address: string;
    lat: number;
    lng: number;
    contactName: string;
    contactPhone: string;
  };
  
  // Status
  status: 'scheduled' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
  
  // Reports
  reports: {
    testId: string;
    reportUrl?: string;
    status: 'pending' | 'ready';
    completedAt?: string;
  }[];
  
  // Timeline
  bookedAt: string;
  collectedAt?: string;
  processedAt?: string;
  completedAt?: string;
  
  // Payment
  totalAmount: number;
  paymentStatus: 'pending' | 'paid';
  
  notes?: string;
}

export function integratedServicesEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * Calculate ambulance fare
   */
  function calculateAmbulanceFare(distance: number, severity: string): number {
    const baseFare = 500;
    const perKmCharge = 20;
    const severityMultiplier = {
      critical: 2.0,
      urgent: 1.5,
      normal: 1.0
    };

    const distanceFare = baseFare + (distance * perKmCharge);
    return Math.ceil(distanceFare * (severityMultiplier[severity as keyof typeof severityMultiplier] || 1.0));
  }

  /**
   * Find nearest ambulance
   */
  async function findNearestAmbulance(lat: number, lng: number) {
    // Get all ambulance vendors
    const allVendors = await kv.getByPrefix('vendor:') || [];
    
    const ambulanceVendors = allVendors
      .map((item: any) => item.value || item)
      .filter((v: any) => v.services?.includes('ambulance') && v.location?.lat && v.location?.lng)
      .map((v: any) => {
        const distance = calculateDistance(lat, lng, v.location.lat, v.location.lng);
        return { ...v, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    return ambulanceVendors[0];
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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

  // ============================================
  // AMBULANCE ENDPOINTS
  // ============================================

  /**
   * POST /ambulance/emergency-booking
   * Create emergency ambulance booking
   */
  app.post(`${BASE_PATH}/ambulance/emergency-booking`, async (c) => {
    try {
      const {
        customerId,
        petId,
        emergencyType,
        severity,
        description,
        pickupLocation,
        dropLocation
      } = await c.req.json();

      console.log(`🚑 Emergency ambulance requested for customer ${customerId}`);

      // Find nearest ambulance
      const nearestVendor = await findNearestAmbulance(
        pickupLocation.lat,
        pickupLocation.lng
      );

      if (!nearestVendor) {
        return sendError(c, 'No ambulance available in your area', 404);
      }

      // Calculate fare
      const distance = calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        dropLocation.lat,
        dropLocation.lng
      );

      const estimatedFare = calculateAmbulanceFare(distance, severity);

      // Create booking
      const bookingId = `AMB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const booking: AmbulanceBooking = {
        id: bookingId,
        customerId,
        petId,
        vendorId: nearestVendor.id,
        emergencyType,
        severity,
        description,
        pickupLocation,
        dropLocation,
        status: 'requested',
        estimatedFare,
        paymentStatus: 'pending',
        requestedAt: new Date().toISOString()
      };

      await kv.set(`ambulance:${bookingId}`, booking);

      // Add to customer's bookings
      const customerBookings = await kv.get(`customer:${customerId}:ambulance`) || [];
      customerBookings.unshift(bookingId);
      await kv.set(`customer:${customerId}:ambulance`, customerBookings);

      console.log(`✅ Ambulance booking created: ${bookingId}`);

      // TODO: Send notification to vendor
      // TODO: Auto-assign driver

      return sendSuccess(c, { booking, message: 'Emergency booking created. Ambulance will arrive shortly.' });

    } catch (error) {
      console.error('❌ Error creating ambulance booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /ambulance/tracking/:bookingId
   * Track ambulance location
   */
  app.get(`${BASE_PATH}/ambulance/tracking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await kv.get(`ambulance:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get current location from driver (simulated)
      // In production, this would get real GPS data
      const tracking = {
        bookingId,
        status: booking.status,
        currentLocation: booking.currentLocation,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        driverName: booking.driverName,
        driverPhone: booking.driverPhone,
        vehicleNumber: booking.vehicleNumber,
        estimatedArrival: booking.status === 'en_route_to_pickup' ? '10 minutes' : 'N/A'
      };

      return sendSuccess(c, { tracking });

    } catch (error) {
      console.error('❌ Error tracking ambulance:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /ambulance/:bookingId/update-location
   * Update ambulance GPS location (driver side)
   */
  app.put(`${BASE_PATH}/ambulance/:bookingId/update-location`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { lat, lng } = await c.req.json();

      const booking = await kv.get(`ambulance:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      booking.currentLocation = {
        lat,
        lng,
        timestamp: new Date().toISOString()
      };

      await kv.set(`ambulance:${bookingId}`, booking);

      return sendSuccess(c, { message: 'Location updated' });

    } catch (error) {
      console.error('❌ Error updating location:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /ambulance/:bookingId/status
   * Update ambulance booking status
   */
  app.put(`${BASE_PATH}/ambulance/:bookingId/status`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status } = await c.req.json();

      const booking = await kv.get(`ambulance:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const oldStatus = booking.status;
      booking.status = status;

      // Update timestamps
      if (status === 'assigned') booking.assignedAt = new Date().toISOString();
      if (status === 'arrived') booking.arrivedAt = new Date().toISOString();
      if (status === 'pet_loaded') booking.loadedAt = new Date().toISOString();
      if (status === 'delivered') booking.deliveredAt = new Date().toISOString();
      if (status === 'completed') booking.completedAt = new Date().toISOString();

      await kv.set(`ambulance:${bookingId}`, booking);

      console.log(`✅ Ambulance ${bookingId} status: ${oldStatus} → ${status}`);

      // TODO: Send notification to customer

      return sendSuccess(c, { booking, message: 'Status updated' });

    } catch (error) {
      console.error('❌ Error updating status:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // DIAGNOSTICS ENDPOINTS
  // ============================================

  /**
   * POST /diagnostics/book-test
   * Book diagnostic tests
   */
  app.post(`${BASE_PATH}/diagnostics/book-test`, async (c) => {
    try {
      const {
        customerId,
        petId,
        vendorId,
        tests,
        appointmentDate,
        appointmentTime,
        serviceStyle,
        collectionLocation
      } = await c.req.json();

      console.log(`🔬 Diagnostic test booking for customer ${customerId}`);

      // Calculate total
      const totalAmount = tests.reduce((sum: number, test: any) => sum + test.price, 0);

      // Create booking
      const bookingId = `DGN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const booking: DiagnosticsBooking = {
        id: bookingId,
        customerId,
        petId,
        vendorId,
        tests,
        appointmentDate,
        appointmentTime,
        serviceStyle,
        collectionLocation,
        status: 'scheduled',
        reports: tests.map((test: any) => ({
          testId: test.testId,
          status: 'pending'
        })),
        totalAmount,
        paymentStatus: 'pending',
        bookedAt: new Date().toISOString()
      };

      await kv.set(`diagnostics:${bookingId}`, booking);

      // Add to customer's bookings
      const customerBookings = await kv.get(`customer:${customerId}:diagnostics`) || [];
      customerBookings.unshift(bookingId);
      await kv.set(`customer:${customerId}:diagnostics`, customerBookings);

      console.log(`✅ Diagnostics booking created: ${bookingId}`);

      // TODO: Send notification to vendor

      return sendSuccess(c, { booking, message: 'Diagnostic test booked successfully' });

    } catch (error) {
      console.error('❌ Error booking test:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /diagnostics/reports/:bookingId
   * Get diagnostic reports
   */
  app.get(`${BASE_PATH}/diagnostics/reports/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await kv.get(`diagnostics:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      return sendSuccess(c, {
        bookingId,
        tests: booking.tests,
        reports: booking.reports,
        status: booking.status
      });

    } catch (error) {
      console.error('❌ Error fetching reports:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /diagnostics/:bookingId/upload-report
   * Upload diagnostic report (vendor side)
   */
  app.put(`${BASE_PATH}/diagnostics/:bookingId/upload-report`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { testId, reportUrl } = await c.req.json();

      const booking = await kv.get(`diagnostics:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Update report
      const report = booking.reports.find((r: any) => r.testId === testId);
      if (report) {
        report.reportUrl = reportUrl;
        report.status = 'ready';
        report.completedAt = new Date().toISOString();
      }

      // Check if all reports are ready
      const allReady = booking.reports.every((r: any) => r.status === 'ready');
      if (allReady) {
        booking.status = 'completed';
        booking.completedAt = new Date().toISOString();
      }

      await kv.set(`diagnostics:${bookingId}`, booking);

      console.log(`✅ Report uploaded for test ${testId} in booking ${bookingId}`);

      // TODO: Send notification to customer

      return sendSuccess(c, { booking, message: 'Report uploaded successfully' });

    } catch (error) {
      console.error('❌ Error uploading report:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/:customerId/diagnostics
   * Get customer's diagnostic bookings
   */
  app.get(`${BASE_PATH}/customer/:customerId/diagnostics`, async (c) => {
    try {
      const { customerId } = c.req.param();

      const bookingIds = await kv.get(`customer:${customerId}:diagnostics`) || [];

      const bookings = [];
      for (const id of bookingIds) {
        const booking = await kv.get(`diagnostics:${id}`);
        if (booking) {
          bookings.push(booking);
        }
      }

      return sendSuccess(c, { bookings, total: bookings.length });

    } catch (error) {
      console.error('❌ Error fetching diagnostics:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/:customerId/ambulance
   * Get customer's ambulance bookings
   */
  app.get(`${BASE_PATH}/customer/:customerId/ambulance`, async (c) => {
    try {
      const { customerId } = c.req.param();

      const bookingIds = await kv.get(`customer:${customerId}:ambulance`) || [];

      const bookings = [];
      for (const id of bookingIds) {
        const booking = await kv.get(`ambulance:${id}`);
        if (booking) {
          bookings.push(booking);
        }
      }

      return sendSuccess(c, { bookings, total: bookings.length });

    } catch (error) {
      console.error('❌ Error fetching ambulance bookings:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Integrated Services Endpoints registered');
}
