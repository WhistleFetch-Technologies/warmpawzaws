/**
 * ============================================================================
 * DIAGNOSTICS CENTER ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete diagnostics center booking and management system
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Diagnostic centers stored in vendors.metadata JSONB field
 * - Tests stored in `diagnostic_tests` table
 * - Bookings stored in `diagnostic_bookings` table
 * - Test packages stored in vendors.metadata or separate table
 * 
 * Date: 2024-12-24
 * Migration: Phase 2 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDiagnosticTestsRepository } from "../../lib/repositories/diagnostic-tests.ts";
import { getDiagnosticBookingsRepository } from "../../lib/repositories/diagnostic-bookings.ts";
import { getDiagnosticReportsRepository } from "../../lib/repositories/diagnostic-reports.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";

// ============================================================================
// TYPES
// ============================================================================

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
  homeCollectionRadius: number;
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
  tests: string[];
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  category: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

// Find nearby diagnostic centers (from vendors with diagnostic role)
async function findNearbyCenters(
  lat: number,
  lng: number,
  radius: number = 20
): Promise<Array<DiagnosticCenter & { distance: number }>> {
  const db = getDbClient();
  
  // Get vendors with diagnostic role and location
  const { data: vendors, error } = await db
    .from('vendors')
    .select('id, business_name, address, city, state, pincode, latitude, longitude, metadata, is_active')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .eq('is_active', true);
  
  if (error) {
    console.error('Error fetching vendors:', error);
    return [];
  }
  
  const nearby: Array<DiagnosticCenter & { distance: number }> = [];
  
  for (const vendor of vendors || []) {
    if (!vendor.latitude || !vendor.longitude) continue;
    
    const distance = calculateDistance(
      lat,
      lng,
      parseFloat(vendor.latitude.toString()),
      parseFloat(vendor.longitude.toString())
    );
    
    if (distance <= radius) {
      // Extract center info from metadata or use vendor data
      const metadata = vendor.metadata || {};
      const centerInfo = metadata.diagnostic_center || {};
      
      nearby.push({
        centerId: centerInfo.centerId || vendor.id,
        vendorId: vendor.id,
        centerName: centerInfo.centerName || vendor.business_name,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        location: {
          lat: parseFloat(vendor.latitude.toString()),
          lng: parseFloat(vendor.longitude.toString())
        },
        phone: centerInfo.phone || '',
        email: centerInfo.email || '',
        openingHours: centerInfo.openingHours || {},
        facilities: centerInfo.facilities || [],
        certifications: centerInfo.certifications || [],
        homeCollectionAvailable: centerInfo.homeCollectionAvailable !== false,
        homeCollectionRadius: centerInfo.homeCollectionRadius || 10,
        rating: centerInfo.rating || 5.0,
        totalTests: centerInfo.totalTests || 0,
        isActive: vendor.is_active,
        createdAt: centerInfo.createdAt || new Date().toISOString(),
        distance: parseFloat(distance.toFixed(2))
      });
    }
  }
  
  nearby.sort((a, b) => a.distance - b.distance);
  return nearby;
}

// Send diagnostic notification
async function sendDiagnosticNotification(
  customerId: string,
  bookingId: string,
  type: string,
  message: string
) {
  const notificationsRepo = getNotificationsRepository();
  const customersRepo = getCustomersRepository();
  
  const customer = await customersRepo.findById(customerId);
  
  if (customer?.user_id) {
    await notificationsRepo.create({
      user_id: customer.user_id,
      notification_type: 'diagnostic',
      title: 'Diagnostic Test Update',
      message,
      data: { bookingId, category: type }
    });
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function diagnosticsCenterEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const testsRepo = getDiagnosticTestsRepository();
  const bookingsRepo = getDiagnosticBookingsRepository();
  const reportsRepo = getDiagnosticReportsRepository();
  const db = getDbClient();

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

      const centers = await findNearbyCenters(lat, lng, radius);

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

      // Get vendor ID from center (centerId might be vendor ID or stored in metadata)
      let vendorId = centerId;
      
      // Try to get vendor to extract center info
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(centerId);
      
      if (vendor) {
        vendorId = vendor.id;
      }

      // Get tests for this vendor
      const allTests = await testsRepo.findByVendor(vendorId);
      
      let tests = allTests.filter(test => test.is_available);

      if (category) {
        tests = tests.filter(test => test.category === category);
      }

      // Map to API format
      const mappedTests = tests.map(test => ({
        testId: test.id,
        testName: test.test_name,
        category: test.category,
        description: test.description,
        price: test.price ? parseFloat(test.price.toString()) : 0,
        duration: test.duration_minutes ? Math.ceil(test.duration_minutes / 60) : 24,
        preparationInstructions: test.preparation_instructions,
        sampleType: test.sample_type,
        reportDeliveryTime: 24, // Default
        homeCollectionAvailable: true, // Default
        homeCollectionCharge: 0, // Default
        isActive: test.is_available,
        vendorId: test.vendor_id,
        createdAt: test.created_at
      }));

      return sendSuccess(c, {
        centerId,
        centerName: vendor?.business_name || 'Diagnostic Center',
        count: mappedTests.length,
        tests: mappedTests
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
        const test = await testsRepo.findById(testId);
        
        if (!test) {
          return sendError(c, `Test not found: ${testId}`, 404);
        }

        if (!test.is_available) {
          return sendError(c, `Test not available: ${test.test_name}`, 400);
        }

        const testPrice = test.price ? parseFloat(test.price.toString()) : 0;
        
        tests.push({
          testId: test.id,
          testName: test.test_name,
          price: testPrice
        });

        totalAmount += testPrice;
      }

      // Add home collection charge if applicable
      if (bookingType === 'home_collection') {
        homeCollectionCharge = 100; // Default charge
        totalAmount += homeCollectionCharge;
      }

      // Create booking number
      const bookingNumber = `DIAG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create booking in SQL
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        pet_id: petId,
        vendor_id: vendorId,
        center_id: centerId,
        booking_number: bookingNumber,
        tests: tests,
        booking_type: bookingType,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        collection_address: bookingType === 'home_collection' ? address : null,
        prescription_url: prescriptionUrl,
        special_instructions: specialInstructions,
        total_amount: totalAmount,
        home_collection_charge: homeCollectionCharge,
        payment_status: 'pending'
      });

      // Send notification
      await sendDiagnosticNotification(
        customerId,
        bookingNumber,
        'booking_confirmed',
        `Diagnostic test booking confirmed for ${scheduledDate} at ${scheduledTime}`
      );

      console.log(`✅ Diagnostic booking created: ${bookingNumber}`);

      return sendSuccess(c, {
        booking: {
          bookingId: bookingNumber,
          id: booking.id,
          status: booking.status,
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

      // Find by booking_number
      const booking = await bookingsRepo.findByBookingNumber(bookingId);

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

      const booking = await bookingsRepo.findByBookingNumber(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const oldStatus = booking.status;
      
      // Prepare updates
      const updates: any = {
        status
      };

      // Update timestamps
      if (status === 'sample_collected') {
        updates.sample_collection_time = new Date().toISOString();
        if (collectorId) updates.collector_id = collectorId;
        if (collectorName) updates.collector_name = collectorName;
      } else if (status === 'completed') {
        updates.report_generation_time = new Date().toISOString();
      }

      await bookingsRepo.update(booking.id, updates);

      // Send notifications
      const statusMessages: Record<string, string> = {
        'sample_collected': 'Sample collected successfully. Your reports are being processed.',
        'processing': 'Your samples are being tested at our lab.',
        'completed': 'Your diagnostic reports are ready! Check your reports section.',
        'cancelled': 'Your diagnostic test booking has been cancelled.'
      };

      if (statusMessages[status]) {
        await sendDiagnosticNotification(
          booking.customer_id,
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

      const booking = await bookingsRepo.findByBookingNumber(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Find test in booking
      const test = booking.tests.find((t: any) => t.testId === testId);
      
      if (!test) {
        return sendError(c, 'Test not found in booking', 404);
      }

      // Store report in booking.reports JSONB field
      // Note: For full report management, use diagnostic_reports table separately

      // Update booking reports array
      const reports = booking.reports || [];
      reports.push({
        testId,
        testName: test.testName,
        reportUrl,
        uploadedAt: new Date().toISOString()
      });

      // Check if all reports uploaded
      const allReportsUploaded = reports.length === booking.tests.length;
      
      if (allReportsUploaded) {
        await bookingsRepo.update(booking.id, {
          status: 'completed',
          report_generation_time: new Date().toISOString(),
          all_reports_uploaded: true,
          reports: reports
        });
        
        await sendDiagnosticNotification(
          booking.customer_id,
          bookingId,
          'reports_ready',
          'All your diagnostic reports are now available!'
        );
      } else {
        await bookingsRepo.update(booking.id, {
          reports: reports
        });
      }

      console.log(`✅ Report uploaded for booking ${bookingId}, test ${testId}`);

      return sendSuccess(c, {
        bookingId,
        testId,
        reportUrl,
        reportsUploaded: reports.length,
        totalTests: booking.tests.length,
        allReportsReady: allReportsUploaded
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

      const bookings = await bookingsRepo.findByCustomer(customerId, {
        status: status || undefined
      });

      return sendSuccess(c, {
        customerId,
        count: bookings.length,
        bookings
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

      const test = await testsRepo.create({
        vendor_id: vendorId,
        test_name: testName,
        category,
        description,
        price,
        duration_minutes: duration * 60, // Convert hours to minutes
        preparation_instructions: preparationInstructions,
        sample_type: sampleType,
        is_available: true
      });

      console.log(`✅ Diagnostic test created: ${test.id}`);

      return sendSuccess(c, { 
        test: {
          testId: test.id,
          testName: test.test_name,
          category: test.category,
          description: test.description,
          price: test.price ? parseFloat(test.price.toString()) : 0,
          duration: test.duration_minutes ? Math.ceil(test.duration_minutes / 60) : 24,
          preparationInstructions: test.preparation_instructions,
          sampleType: test.sample_type,
          reportDeliveryTime,
          homeCollectionAvailable,
          homeCollectionCharge,
          isActive: test.is_available,
          vendorId: test.vendor_id,
          createdAt: test.created_at
        }
      }, 'Test created successfully');

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
        const test = await testsRepo.findById(testId);
        if (test && test.price) {
          originalPrice += parseFloat(test.price.toString());
        }
      }

      const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));
      const savings = originalPrice - discountedPrice;

      const packageId = `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Store package in vendor metadata
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      const metadata = vendor.metadata || {};
      const packages = metadata.diagnostic_packages || [];
      
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

      packages.push(testPackage);
      metadata.diagnostic_packages = packages;

      await vendorsRepo.update(vendorId, {
        metadata: metadata
      });

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

      // Store center info in vendor metadata
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      const metadata = vendor.metadata || {};
      
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

      metadata.diagnostic_center = center;

      // Update vendor with center info and location
      await vendorsRepo.update(vendorId, {
        metadata: metadata,
        latitude: location.lat,
        longitude: location.lng,
        address: address,
        city: city,
        state: state || vendor.state,
        pincode: pincode || vendor.pincode
      });

      console.log(`✅ Diagnostic center registered: ${centerId}`);

      return sendSuccess(c, { center }, 'Center registered successfully');

    } catch (error) {
      console.error('❌ Error registering center:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Diagnostics Center Endpoints registered (SQL-only)');
}

