/**
 * ============================================================================
 * HOLIDAY PACKAGE SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Holiday package creation (with QA aliases)
 * - Package browsing and filtering
 * - Package booking
 * - Group tour management
 * - Availability management
 * - Vendor dashboard
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getHolidayPackagesRepository } from "../../lib/repositories/holiday-packages.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

export function holidayPackageSystemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const holidayRepo = getHolidayPackagesRepository();

  // ========================================
  // HOLIDAY PACKAGE MANAGEMENT
  // ========================================

  // Create holiday package
  app.post(`${BASE_PATH}/holiday-packages/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        packageName,
        description,
        destination,
        packageType,
        duration,
        pricing,
        inclusions = [],
        exclusions = [],
        isGroupTour = false,
        minGroupSize,
        maxGroupSize,
        availableDates = [],
        itinerary = [],
        requirements = {},
        cancellationPolicy,
        refundPolicy
      } = body;

      if (!vendorId || !packageName || !destination || !packageType || !duration || !pricing) {
        return sendError(c, 'Required fields missing', 400);
      }

      // ✅ SQL: Create package
      const holidayPackage = await holidayRepo.createPackage({
        vendorId,
        packageName,
        description,
        destination,
        packageType: packageType as any,
        durationDays: duration.days || duration.days || 1,
        durationNights: duration.nights || duration.nights || 0,
        basePrice: pricing.basePrice,
        pricePerPet: pricing.pricePerPet || 0,
        pricePerAdult: pricing.pricePerAdult || 0,
        pricePerChild: pricing.pricePerChild || 0,
        currency: pricing.currency || 'INR',
        inclusions,
        exclusions,
        isGroupTour,
        minGroupSize,
        maxGroupSize,
        availableDates,
        itinerary,
        requirements,
        cancellationPolicy: cancellationPolicy || 'Standard cancellation policy applies',
        refundPolicy: refundPolicy || 'Refund available up to 7 days before departure',
        isActive: true,
      });

      console.log(`✅ Holiday package created: ${holidayPackage.packageId}`);

      return sendSuccess(c, { package: holidayPackage }, 'Holiday package created successfully');
    } catch (error) {
      console.error('Error creating holiday package:', error);
      return sendError(c, String(error), 500);
    }
  });
  
  // ALIAS: POST /holiday/package/create (QA Requirement)
  app.post(`${BASE_PATH}/holiday/package/create`, async (c) => {
    try {
      const body = await c.req.json();
      const { vendorId, name, type, duration, price } = body; 
      
      if (!vendorId || !name) {
        return sendError(c, 'Vendor ID and Name required', 400);
      }

      // ✅ SQL: Create package (QA style)
      const holidayPackage = await holidayRepo.createPackage({
        vendorId,
        packageName: name,
        packageType: type || 'adventure',
        durationDays: duration?.days || duration || 1,
        durationNights: duration?.nights || 0,
        basePrice: price || 0,
        pricePerPet: 0,
        pricePerAdult: 0,
        pricePerChild: 0,
        currency: 'INR',
        inclusions: [],
        exclusions: [],
        isGroupTour: false,
        availableDates: [],
        itinerary: [],
        requirements: {},
        isActive: true,
      });
      
      return sendSuccess(c, { packageId: holidayPackage.packageId, message: 'Package created (QA Alias)' });
    } catch (e) {
      return sendError(c, String(e), 500);
    }
  });

  // ALIAS: POST /holiday/package/configure-dates (QA Requirement)
  app.post(`${BASE_PATH}/holiday/package/configure-dates`, async (c) => {
    try {
      const { packageId, dates } = await c.req.json();
      if (!packageId || !dates) {
        return sendError(c, 'Package ID and Dates required', 400);
      }
      
      // ✅ SQL: Get package
      const pkg = await holidayRepo.getPackageById(packageId);
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }
      
      // ✅ SQL: Update package with dates
      const updated = await holidayRepo.updatePackage(packageId, {
        availableDates: dates,
      });

      if (!updated) {
        return sendError(c, 'Failed to update dates', 500);
      }
      
      return sendSuccess(c, { message: 'Dates configured' });
    } catch (e) {
      return sendError(c, String(e), 500);
    }
  });
  
  // ALIAS: PUT /holiday/package/:packageId (QA Requirement)
  app.put(`${BASE_PATH}/holiday/package/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const updates = await c.req.json();
      
      // ✅ SQL: Get package
      const pkg = await holidayRepo.getPackageById(packageId);
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }
      
      // ✅ SQL: Update package
      const updated = await holidayRepo.updatePackage(packageId, {
        packageName: updates.name || updates.packageName,
        description: updates.description,
        destination: updates.destination,
        isActive: updates.isActive !== undefined ? updates.isActive : pkg.isActive,
        ...updates,
      });
      
      if (!updated) {
        return sendError(c, 'Failed to update package', 500);
      }
      
      return sendSuccess(c, { package: updated });
    } catch (e) {
      return sendError(c, String(e), 500);
    }
  });

  // List all holiday packages
  app.get(`${BASE_PATH}/holiday-packages/list`, async (c) => {
    try {
      const packageType = c.req.query('type');
      const destination = c.req.query('destination');
      const minPrice = c.req.query('minPrice');
      const maxPrice = c.req.query('maxPrice');

      // ✅ SQL: Get all packages
      let packages = await holidayRepo.getAllPackages({
        packageType: packageType || undefined,
        destination: destination || undefined,
        isActive: true,
      });

      // Apply filters
      if (minPrice) {
        packages = packages.filter((pkg: any) => pkg.basePrice >= parseFloat(minPrice));
      }

      if (maxPrice) {
        packages = packages.filter((pkg: any) => pkg.basePrice <= parseFloat(maxPrice));
      }

      return sendSuccess(c, { packages, count: packages.length });
    } catch (error) {
      console.error('Error listing packages:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Get package details
  app.get(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');

      // ✅ SQL: Get package
      const holidayPackage = await holidayRepo.getPackageById(packageId);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      return sendSuccess(c, { package: holidayPackage });
    } catch (error) {
      console.error('Error getting package:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Update holiday package
  app.put(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const updates = await c.req.json();

      // ✅ SQL: Get package
      const holidayPackage = await holidayRepo.getPackageById(packageId);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      // ✅ SQL: Update package
      const updated = await holidayRepo.updatePackage(packageId, {
        packageName: updates.packageName,
        description: updates.description,
        destination: updates.destination,
        isActive: updates.isActive !== undefined ? updates.isActive : holidayPackage.isActive,
        availableDates: updates.availableDates,
        ...updates,
      });

      if (!updated) {
        return sendError(c, 'Failed to update package', 500);
      }

      console.log(`✅ Holiday package ${packageId} updated`);

      return sendSuccess(c, { package: updated }, 'Package updated successfully');
    } catch (error) {
      console.error('Error updating package:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Delete (deactivate) holiday package
  app.delete(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');

      // ✅ SQL: Get package
      const holidayPackage = await holidayRepo.getPackageById(packageId);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      // ✅ SQL: Deactivate package
      const updated = await holidayRepo.updatePackage(packageId, {
        isActive: false,
      });

      if (!updated) {
        return sendError(c, 'Failed to deactivate package', 500);
      }

      console.log(`✅ Holiday package ${packageId} deactivated`);

      return sendSuccess(c, {}, 'Package deactivated successfully');
    } catch (error) {
      console.error('Error deleting package:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ========================================
  // HOLIDAY BOOKING
  // ========================================

  // Book holiday package
  app.post(`${BASE_PATH}/holiday-packages/:packageId/book`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const body = await c.req.json();
      const {
        customerId,
        selectedStartDate,
        selectedEndDate,
        travelers,
        groupMembers,
        specialRequests,
        dietaryRequirements,
      } = body;

      if (!customerId || !selectedStartDate || !selectedEndDate || !travelers) {
        return sendError(c, 'Required fields missing', 400);
      }

      // ✅ SQL: Get package
      const holidayPackage = await holidayRepo.getPackageById(packageId);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      // Calculate pricing
      const basePrice = holidayPackage.basePrice;
      const petCharges = (travelers.pets?.length || 0) * holidayPackage.pricePerPet;
      const adultCharges = (travelers.adults || 0) * holidayPackage.pricePerAdult;
      const childCharges = (travelers.children || 0) * holidayPackage.pricePerChild;
      const totalAmount = basePrice + petCharges + adultCharges + childCharges;

      // ✅ SQL: Create booking
      const booking = await holidayRepo.createBooking({
        packageId: holidayPackage.packageId,
        customerId,
        vendorId: holidayPackage.vendorId,
        selectedStartDate,
        selectedEndDate,
        travelers,
        pricing: {
          basePrice,
          petCharges,
          adultCharges,
          childCharges,
          totalAmount
        },
        status: 'pending',
        paymentStatus: 'pending',
        isGroupTour: holidayPackage.isGroupTour,
        groupMembers,
        specialRequests,
        dietaryRequirements,
      });

      // ✅ SQL: Update package availability
      if (holidayPackage.availableDates && holidayPackage.availableDates.length > 0) {
        const dateIndex = holidayPackage.availableDates.findIndex(
          (d: any) => d.startDate === selectedStartDate && d.endDate === selectedEndDate
        );

        if (dateIndex !== -1) {
          holidayPackage.availableDates[dateIndex].bookedSlots += 1;
          await holidayRepo.updatePackage(packageId, {
            availableDates: holidayPackage.availableDates,
            currentBookings: holidayPackage.currentBookings + 1,
          });
        }
      }

      console.log(`✅ Holiday booking created: ${booking.bookingId}`);

      return sendSuccess(c, { booking }, 'Booking created successfully');
    } catch (error) {
      console.error('Error creating booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Check package availability
  app.get(`${BASE_PATH}/holiday-packages/:packageId/availability`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');

      // ✅ SQL: Get package
      const holidayPackage = await holidayRepo.getPackageById(packageId);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      let availability = { isAvailable: true, availableSlots: 0 };

      if (startDate && endDate && holidayPackage.availableDates && holidayPackage.availableDates.length > 0) {
        const dateSlot = holidayPackage.availableDates.find(
          (d: any) => d.startDate === startDate && d.endDate === endDate
        );

        if (dateSlot) {
          availability.availableSlots = dateSlot.availableSlots - dateSlot.bookedSlots;
          availability.isAvailable = availability.availableSlots > 0;
        } else {
          availability.isAvailable = false;
        }
      }

      return sendSuccess(c, { availability });
    } catch (error) {
      console.error('Error checking availability:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Get booking details
  app.get(`${BASE_PATH}/holiday-packages/bookings/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // ✅ SQL: Get booking
      const booking = await holidayRepo.getBookingById(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Get package details
      const holidayPackage = await holidayRepo.getPackageById(booking.packageId);

      return sendSuccess(c, { booking, package: holidayPackage });
    } catch (error) {
      console.error('Error getting booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Update booking status
  app.put(`${BASE_PATH}/holiday-packages/bookings/:bookingId/status`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { status, paymentStatus } = await c.req.json();

      // ✅ SQL: Get booking
      const booking = await holidayRepo.getBookingById(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Update booking
      const updated = await holidayRepo.updateBooking(bookingId, {
        status: status || booking.status,
        paymentStatus: paymentStatus || booking.paymentStatus,
        confirmedAt: status === 'confirmed' ? new Date().toISOString() : booking.confirmedAt,
        cancelledAt: status === 'cancelled' ? new Date().toISOString() : booking.cancelledAt,
        completedAt: status === 'completed' ? new Date().toISOString() : booking.completedAt,
      });

      if (!updated) {
        return sendError(c, 'Failed to update booking', 500);
      }

      console.log(`✅ Booking ${bookingId} status updated to: ${status}`);

      return sendSuccess(c, { booking: updated }, 'Booking status updated successfully');
    } catch (error) {
      console.error('Error updating booking status:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Get vendor's holiday packages
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get vendor packages
      const packages = await holidayRepo.getAllPackages({ vendorId });

      return sendSuccess(c, { packages: packages.filter(Boolean) });
    } catch (error) {
      console.error('Error getting vendor packages:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Get vendor's holiday bookings
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-bookings`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get vendor bookings
      const bookings = await holidayRepo.getVendorBookings(vendorId);

      return sendSuccess(c, { bookings: bookings.filter(Boolean) });
    } catch (error) {
      console.error('Error getting vendor bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Get customer's holiday bookings
  app.get(`${BASE_PATH}/customer/:customerId/holiday-bookings`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // ✅ SQL: Get customer bookings
      const bookings = await holidayRepo.getCustomerBookings(customerId);

      return sendSuccess(c, { bookings: bookings.filter(Boolean) });
    } catch (error) {
      console.error('Error getting customer bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Holiday Package System endpoints (SQL) registered');
}

