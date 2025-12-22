import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🔬 DIAGNOSTICS CENTER ENDPOINTS
 * 
 * Complete diagnostics center booking and management system
 * 
 * Features:
 * - Test catalog management
 * - Test booking (home collection & center visit)
 * - Sample collection scheduling
 * - Report generation and delivery
 * - Package/panel management
 * - Real-time status tracking
 * 
 * Test Types:
 * - Blood tests
 * - Urine tests
 * - Stool tests
 * - Imaging (X-ray, Ultrasound)
 * - Specialized tests
 */

interface DiagnosticTest {
  testId: string;
  testName: string;
  category: 'blood' | 'urine' | 'stool' | 'imaging' | 'specialized' | 'panel';
  description: string;
  price: number;
  duration: number; // in hours
  preparationInstructions?: string;
  sampleType?: string;
  reportDeliveryTime: number; // in hours
  homeCollectionAvailable: boolean;
  homeCollectionCharge?: number;
  isActive: boolean;
  vendorId: string;
  createdAt: string;
}

interface DiagnosticBooking {
  bookingId: string;
  customerId: string;
  petId: string;
  petName: string;
  vendorId: string;
  tests: Array<{
    testId: string;
    testName: string;
    price: number;
  }>;
  bookingType: 'home_collection' | 'center_visit';
  scheduledDate: string;
  scheduledTime: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  status: 'scheduled' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
  collectorId?: string;
  collectorName?: string;
  sampleCollectionTime?: string;
  reportGenerationTime?: string;
  reportUrl?: string;
  reports?: Array<{
    testId: string;
    testName: string;
    reportUrl: string;
    uploadedAt: string;
  }>;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  prescriptionUrl?: string;
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

interface DiagnosticCenter {
  centerId: string;
  vendorId: string;
  centerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: { lat: number; lng: number };
  phone: string;
  email: string;
  openingHours: {
    [key: string]: { open: string; close: string; isOpen: boolean };
  };
  facilities: string[];
  certifications: string[];
  homeCollectionAvailable: boolean;
  homeCollectionRadius: number; // in km
  rating: number;
  totalTests: number;
  isActive: boolean;
  createdAt: string;
}

interface TestPackage {
  packageId: string;
  packageName: string;
  description: string;
  vendorId: string;
  tests: string[]; // testIds
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  category: string;
  isActive: boolean;
  createdAt: string;
}

// Calculate distance using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearby diagnostic centers
async function findNearbyCenters(
  kv: any,
  lat: number,
  lng: number,
  radius: number = 20
): Promise<Array<DiagnosticCenter & { distance: number }>> {
  const centers = await kv.getByPrefix('diagnostics:center:') || [];
  const nearby: Array<DiagnosticCenter & { distance: number }> = [];

  for (const item of centers) {
    const center = item.value || item;
    
    if (!center.isActive || !center.location) continue;

    const distance = calculateDistance(
      lat,
      lng,
      center.location.lat,
      center.location.lng
    );

    if (distance <= radius) {
      nearby.push({
        ...center,
        distance: parseFloat(distance.toFixed(2))
      });
    }
  }

  nearby.sort((a, b) => a.distance - b.distance);
  return nearby;
}

// Send diagnostic notification
async function sendDiagnosticNotification(
  kv: any,
  customerId: string,
  bookingId: string,
  type: string,
  message: string
) {
  const notification = {
    notificationId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: customerId,
    type: 'diagnostic',
    category: type,
    title: 'Diagnostic Test Update',
    message,
    data: { bookingId },
    isRead: false,
    createdAt: new Date().toISOString()
  };

  await kv.set(`notification:${notification.notificationId}`, notification);
}

export function diagnosticsCenterEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /diagnostics/centers/nearby
   * Find nearby diagnostic centers
   */
  app.get(`${BASE_PATH}/diagnostics/centers/nearby`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseFloat(c.req.query('radius') || '20');

      if (!lat || !lng) {
        return sendError(c, 'Missing location coordinates', 400);
      }

      const centers = await findNearbyCenters(kv, lat, lng, radius);

      return sendSuccess(c, {
        location: { lat, lng },
        radius,
        count: centers.length,
        centers
      });

    } catch (error) {
      console.error('❌ Error finding nearby centers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /diagnostics/center/:centerId/tests
   * Get available tests for a diagnostic center
   */
  app.get(`${BASE_PATH}/diagnostics/center/:centerId/tests`, async (c) => {
    try {
      const { centerId } = c.req.param();
      const category = c.req.query('category');

      const center = await kv.get(`diagnostics:center:${centerId}`);
      
      if (!center) {
        return sendError(c, 'Diagnostic center not found', 404);
      }

      const allTests = await kv.getByPrefix('diagnostics:test:') || [];
      
      let tests = allTests
        .map((item: any) => item.value || item)
        .filter((test: any) => test.vendorId === center.vendorId && test.isActive);

      if (category) {
        tests = tests.filter((test: any) => test.category === category);
      }

      return sendSuccess(c, {
        centerId,
        centerName: center.centerName,
        count: tests.length,
        tests
      });

    } catch (error) {
      console.error('❌ Error fetching tests:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /diagnostics/booking/create
   * Create diagnostic test booking
   */
  app.post(`${BASE_PATH}/diagnostics/booking/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        petId,
        petName,
        vendorId,
        centerId,
        testIds,
        bookingType,
        scheduledDate,
        scheduledTime,
        address,
        prescriptionUrl,
        specialInstructions
      } = body;

      // Validation
      if (!customerId || !petId || !vendorId || !testIds || testIds.length === 0) {
        return sendError(c, 'Missing required fields', 400);
      }

      if (!bookingType || !['home_collection', 'center_visit'].includes(bookingType)) {
        return sendError(c, 'Invalid booking type', 400);
      }

      if (bookingType === 'home_collection' && !address) {
        return sendError(c, 'Address required for home collection', 400);
      }

      // Get test details
      const tests: Array<{ testId: string; testName: string; price: number }> = [];
      let totalAmount = 0;
      let homeCollectionCharge = 0;

      for (const testId of testIds) {
        const test = await kv.get(`diagnostics:test:${testId}`);
        
        if (!test) {
          return sendError(c, `Test not found: ${testId}`, 404);
        }

        if (!test.isActive) {
          return sendError(c, `Test not available: ${test.testName}`, 400);
        }

        if (bookingType === 'home_collection' && !test.homeCollectionAvailable) {
          return sendError(c, `Home collection not available for: ${test.testName}`, 400);
        }

        tests.push({
          testId: test.testId,
          testName: test.testName,
          price: test.price
        });

        totalAmount += test.price;
        
        if (bookingType === 'home_collection' && test.homeCollectionCharge) {
          homeCollectionCharge = Math.max(homeCollectionCharge, test.homeCollectionCharge);
        }
      }

      totalAmount += homeCollectionCharge;

      // Create booking
      const bookingId = `DIAG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const booking: DiagnosticBooking = {
        bookingId,
        customerId,
        petId,
        petName,
        vendorId,
        tests,
        bookingType,
        scheduledDate,
        scheduledTime,
        address,
        status: 'scheduled',
        totalAmount,
        paymentStatus: 'pending',
        prescriptionUrl,
        specialInstructions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`diagnostics:booking:${bookingId}`, booking);

      // Send notification
      await sendDiagnosticNotification(
        kv,
        customerId,
        bookingId,
        'booking_confirmed',
        `Diagnostic test booking confirmed for ${scheduledDate} at ${scheduledTime}`
      );

      console.log(`✅ Diagnostic booking created: ${bookingId}`);

      return sendSuccess(c, {
        booking: {
          bookingId,
          status: 'scheduled',
          scheduledDate,
          scheduledTime,
          totalAmount,
          testCount: tests.length
        }
      }, 'Diagnostic test booking created successfully');

    } catch (error) {
      console.error('❌ Error creating diagnostic booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /diagnostics/booking/:bookingId
   * Get diagnostic booking details
   */
  app.get(`${BASE_PATH}/diagnostics/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await kv.get(`diagnostics:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      return sendSuccess(c, { booking });

    } catch (error) {
      console.error('❌ Error fetching booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /diagnostics/booking/:bookingId/update-status
   * Update booking status
   */
  app.post(`${BASE_PATH}/diagnostics/booking/:bookingId/update-status`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json();
      const { status, collectorId, collectorName } = body;

      const validStatuses = ['scheduled', 'sample_collected', 'processing', 'completed', 'cancelled'];

      if (!status || !validStatuses.includes(status)) {
        return sendError(c, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      const booking = await kv.get(`diagnostics:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const oldStatus = booking.status;
      booking.status = status;
      booking.updatedAt = new Date().toISOString();

      // Update timestamps
      if (status === 'sample_collected') {
        booking.sampleCollectionTime = new Date().toISOString();
        if (collectorId) booking.collectorId = collectorId;
        if (collectorName) booking.collectorName = collectorName;
      } else if (status === 'processing') {
        // Sample received at lab
      } else if (status === 'completed') {
        booking.reportGenerationTime = new Date().toISOString();
      }

      await kv.set(`diagnostics:booking:${bookingId}`, booking);

      // Send notifications
      const statusMessages: Record<string, string> = {
        'sample_collected': 'Sample collected successfully. Your reports are being processed.',
        'processing': 'Your samples are being tested at our lab.',
        'completed': 'Your diagnostic reports are ready! Check your reports section.',
        'cancelled': 'Your diagnostic test booking has been cancelled.'
      };

      if (statusMessages[status]) {
        await sendDiagnosticNotification(
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
   * POST /diagnostics/booking/:bookingId/upload-report
   * Upload test report
   */
  app.post(`${BASE_PATH}/diagnostics/booking/:bookingId/upload-report`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json();
      const { testId, reportUrl } = body;

      if (!testId || !reportUrl) {
        return sendError(c, 'Missing testId or reportUrl', 400);
      }

      const booking = await kv.get(`diagnostics:booking:${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Find test
      const test = booking.tests.find((t: any) => t.testId === testId);
      
      if (!test) {
        return sendError(c, 'Test not found in booking', 404);
      }

      // Add report
      if (!booking.reports) booking.reports = [];
      
      booking.reports.push({
        testId,
        testName: test.testName,
        reportUrl,
        uploadedAt: new Date().toISOString()
      });

      // If all reports uploaded, mark as completed
      if (booking.reports.length === booking.tests.length) {
        booking.status = 'completed';
        booking.reportGenerationTime = new Date().toISOString();
        
        await sendDiagnosticNotification(
          kv,
          booking.customerId,
          bookingId,
          'reports_ready',
          'All your diagnostic reports are now available!'
        );
      }

      booking.updatedAt = new Date().toISOString();

      await kv.set(`diagnostics:booking:${bookingId}`, booking);

      console.log(`✅ Report uploaded for booking ${bookingId}, test ${testId}`);

      return sendSuccess(c, {
        bookingId,
        testId,
        reportUrl,
        reportsUploaded: booking.reports.length,
        totalTests: booking.tests.length
      }, 'Report uploaded successfully');

    } catch (error) {
      console.error('❌ Error uploading report:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /diagnostics/customer/:customerId/bookings
   * Get customer's diagnostic booking history
   */
  app.get(`${BASE_PATH}/diagnostics/customer/:customerId/bookings`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      const allBookings = await kv.getByPrefix('diagnostics:booking:') || [];
      
      let customerBookings = allBookings
        .map((item: any) => item.value || item)
        .filter((booking: any) => booking.customerId === customerId);

      if (status) {
        customerBookings = customerBookings.filter((b: any) => b.status === status);
      }

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
   * POST /diagnostics/test/create
   * Create new diagnostic test (vendor/admin)
   */
  app.post(`${BASE_PATH}/diagnostics/test/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        testName,
        category,
        description,
        price,
        duration = 24,
        preparationInstructions,
        sampleType,
        reportDeliveryTime = 24,
        homeCollectionAvailable = true,
        homeCollectionCharge = 0
      } = body;

      if (!vendorId || !testName || !category || !price) {
        return sendError(c, 'Missing required fields', 400);
      }

      const testId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const test: DiagnosticTest = {
        testId,
        testName,
        category,
        description: description || '',
        price,
        duration,
        preparationInstructions,
        sampleType,
        reportDeliveryTime,
        homeCollectionAvailable,
        homeCollectionCharge,
        isActive: true,
        vendorId,
        createdAt: new Date().toISOString()
      };

      await kv.set(`diagnostics:test:${testId}`, test);

      console.log(`✅ Diagnostic test created: ${testId}`);

      return sendSuccess(c, { test }, 'Test created successfully');

    } catch (error) {
      console.error('❌ Error creating test:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /diagnostics/package/create
   * Create test package
   */
  app.post(`${BASE_PATH}/diagnostics/package/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        packageName,
        description,
        testIds,
        discountPercentage = 10,
        category
      } = body;

      if (!vendorId || !packageName || !testIds || testIds.length === 0) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Calculate pricing
      let originalPrice = 0;
      
      for (const testId of testIds) {
        const test = await kv.get(`diagnostics:test:${testId}`);
        if (test) {
          originalPrice += test.price;
        }
      }

      const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));
      const savings = originalPrice - discountedPrice;

      const packageId = `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const testPackage: TestPackage = {
        packageId,
        packageName,
        description: description || '',
        vendorId,
        tests: testIds,
        originalPrice,
        discountedPrice,
        savings,
        category: category || 'general',
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await kv.set(`diagnostics:package:${packageId}`, testPackage);

      console.log(`✅ Test package created: ${packageId}`);

      return sendSuccess(c, { package: testPackage }, 'Package created successfully');

    } catch (error) {
      console.error('❌ Error creating package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /diagnostics/center/register
   * Register diagnostic center
   */
  app.post(`${BASE_PATH}/diagnostics/center/register`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        centerName,
        address,
        city,
        state,
        pincode,
        location,
        phone,
        email,
        openingHours,
        facilities = [],
        certifications = [],
        homeCollectionAvailable = true,
        homeCollectionRadius = 10
      } = body;

      if (!vendorId || !centerName || !address || !city || !location) {
        return sendError(c, 'Missing required fields', 400);
      }

      const centerId = `DIAG-CTR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const center: DiagnosticCenter = {
        centerId,
        vendorId,
        centerName,
        address,
        city,
        state: state || '',
        pincode: pincode || '',
        location,
        phone: phone || '',
        email: email || '',
        openingHours: openingHours || {},
        facilities,
        certifications,
        homeCollectionAvailable,
        homeCollectionRadius,
        rating: 5.0,
        totalTests: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await kv.set(`diagnostics:center:${centerId}`, center);

      console.log(`✅ Diagnostic center registered: ${centerId}`);

      return sendSuccess(c, { center }, 'Center registered successfully');

    } catch (error) {
      console.error('❌ Error registering center:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Diagnostics Center Endpoints registered');
}
