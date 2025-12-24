/**
 * ============================================================================
 * HOLIDAY PACKAGE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Package browsing and filtering
 * - Package booking
 * - Customer booking history
 * - Vendor package management
 * - Analytics
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
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

export function holidayPackageEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ============================================
  // CUSTOMER ENDPOINTS
  // ============================================

  /**
   * GET /holiday-packages
   * Browse all available holiday packages
   */
  app.get(`${BASE_PATH}/holiday-packages`, async (c) => {
    try {
      const { tourType, minPrice, maxPrice, minDuration, maxDuration, destination } = c.req.query();

      console.log('🏖️ Loading holiday packages...');

      // ✅ SQL: Get all packages
      const holidayRepo = getHolidayPackagesRepository();
      const allPackages = await holidayRepo.getAllPackages({
        packageType: tourType || undefined,
        destination: destination || undefined,
        isActive: true,
      });

      // Apply filters
      let packages = allPackages;

      if (minPrice) {
        packages = packages.filter((p: any) => p.basePrice >= parseFloat(minPrice));
      }

      if (maxPrice) {
        packages = packages.filter((p: any) => p.basePrice <= parseFloat(maxPrice));
      }

      if (minDuration) {
        packages = packages.filter((p: any) => p.durationDays >= parseInt(minDuration));
      }

      if (maxDuration) {
        packages = packages.filter((p: any) => p.durationDays <= parseInt(maxDuration));
      }

      // Sort by rating and popularity
      packages.sort((a: any, b: any) => {
        const scoreA = (a.rating || 0) * 0.7 + (a.currentBookings || 0) * 0.3;
        const scoreB = (b.rating || 0) * 0.7 + (b.currentBookings || 0) * 0.3;
        return scoreB - scoreA;
      });

      console.log(`✅ Loaded ${packages.length} holiday packages`);

      return sendSuccess(c, { packages, total: packages.length });

    } catch (error) {
      console.error('❌ Error loading holiday packages:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /holiday-packages/:packageId
   * Get detailed package information
   */
  app.get(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const { packageId } = c.req.param();

      // ✅ SQL: Get package
      const holidayRepo = getHolidayPackagesRepository();
      const pkg = await holidayRepo.getPackageById(packageId);
      
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }

      return sendSuccess(c, { package: pkg });

    } catch (error) {
      console.error('❌ Error loading package:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /holiday-packages/book
   * Book a holiday package
   */
  app.post(`${BASE_PATH}/holiday-packages/book`, async (c) => {
    try {
      const {
        customerId,
        packageId,
        vendorId,
        selectedStartDate,
        selectedEndDate,
        travelers,
        totalAmount,
      } = await c.req.json();

      console.log(`🏖️ Booking holiday package ${packageId} for customer ${customerId}`);

      // ✅ SQL: Validate package exists and is available
      const holidayRepo = getHolidayPackagesRepository();
      const pkg = await holidayRepo.getPackageById(packageId);
      
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }

      if (!pkg.isActive) {
        return sendError(c, 'Package is not available', 400);
      }

      // Check availability for selected date
      const selectedDateStr = selectedStartDate;
      const availableDate = pkg.availableDates.find((d: any) => 
        d.startDate === selectedDateStr || (d.startDate <= selectedDateStr && d.endDate >= selectedDateStr)
      );
      
      if (!availableDate || availableDate.bookedSlots >= availableDate.availableSlots) {
        return sendError(c, 'Selected date is not available', 400);
      }

      // Calculate pricing
      const pricing = {
        basePrice: pkg.basePrice,
        petCharges: (travelers.pets?.length || 0) * pkg.pricePerPet,
        adultCharges: (travelers.adults || 0) * pkg.pricePerAdult,
        childCharges: (travelers.children || 0) * pkg.pricePerChild,
        totalAmount: totalAmount || (pkg.basePrice + 
          (travelers.pets?.length || 0) * pkg.pricePerPet +
          (travelers.adults || 0) * pkg.pricePerAdult +
          (travelers.children || 0) * pkg.pricePerChild),
      };

      // ✅ SQL: Create booking
      const booking = await holidayRepo.createBooking({
        packageId: pkg.packageId,
        customerId,
        vendorId: pkg.vendorId,
        selectedStartDate,
        selectedEndDate,
        travelers,
        pricing,
        status: 'pending',
        paymentStatus: 'pending',
        isGroupTour: pkg.isGroupTour,
      });

      // ✅ SQL: Update package booking count
      await holidayRepo.updatePackage(pkg.packageId, {
        currentBookings: pkg.currentBookings + 1,
      });

      // Update available date slots
      if (availableDate) {
        availableDate.bookedSlots += 1;
        const updatedDates = pkg.availableDates.map((d: any) => 
          d.startDate === availableDate.startDate ? availableDate : d
        );
        await holidayRepo.updatePackage(pkg.packageId, {
          availableDates: updatedDates,
        });
      }

      console.log(`✅ Holiday booking created: ${booking.bookingId}`);

      return sendSuccess(c, { booking, message: 'Holiday package booked successfully' });

    } catch (error) {
      console.error('❌ Error booking holiday package:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /customer/:customerId/holiday-bookings
   * Get customer's holiday bookings
   */
  app.get(`${BASE_PATH}/customer/:customerId/holiday-bookings`, async (c) => {
    try {
      const { customerId } = c.req.param();

      // ✅ SQL: Get customer bookings
      const holidayRepo = getHolidayPackagesRepository();
      const bookings = await holidayRepo.getCustomerBookings(customerId);

      return sendSuccess(c, { bookings, total: bookings.length });

    } catch (error) {
      console.error('❌ Error loading holiday bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ============================================
  // VENDOR ENDPOINTS
  // ============================================

  /**
   * POST /vendor/:vendorId/holiday-packages
   * Create a new holiday package
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const packageData = await c.req.json();

      console.log(`🏖️ Creating holiday package for vendor ${vendorId}`);

      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Create package
      const holidayRepo = getHolidayPackagesRepository();
      const pkg = await holidayRepo.createPackage({
        vendorId,
        packageName: packageData.title || packageData.packageName,
        description: packageData.description,
        destination: packageData.destination,
        destinationImage: packageData.photos?.[0] || packageData.destinationImage,
        packageType: packageData.tourType || packageData.packageType || 'adventure',
        durationDays: packageData.duration?.days || packageData.durationDays || 3,
        durationNights: packageData.duration?.nights || packageData.durationNights || 2,
        basePrice: packageData.price || packageData.basePrice,
        pricePerPet: packageData.pricePerPet || 0,
        pricePerAdult: packageData.pricePerAdult || 0,
        pricePerChild: packageData.pricePerChild || 0,
        currency: 'INR',
        inclusions: packageData.inclusions || [],
        exclusions: packageData.exclusions || [],
        isGroupTour: packageData.tourType === 'group' || packageData.isGroupTour || false,
        minGroupSize: packageData.minGroupSize,
        maxGroupSize: packageData.maxPets || packageData.maxGroupSize,
        availableDates: packageData.availableDates || [],
        itinerary: packageData.itinerary || [],
        requirements: packageData.requirements || {},
        cancellationPolicy: packageData.cancellationPolicy,
        refundPolicy: packageData.refundPolicy,
        isActive: true,
      });

      console.log(`✅ Holiday package created: ${pkg.packageId}`);

      return sendSuccess(c, { package: pkg, message: 'Package created successfully' });

    } catch (error) {
      console.error('❌ Error creating holiday package:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-packages
   * Get vendor's holiday packages
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get vendor packages
      const holidayRepo = getHolidayPackagesRepository();
      const packages = await holidayRepo.getAllPackages({ vendorId });

      return sendSuccess(c, { packages, total: packages.length });

    } catch (error) {
      console.error('❌ Error loading vendor packages:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/holiday-packages/:packageId
   * Update holiday package
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/holiday-packages/:packageId`, async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get package
      const holidayRepo = getHolidayPackagesRepository();
      const pkg = await holidayRepo.getPackageById(packageId);
      
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }

      if (pkg.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Update package
      const updated = await holidayRepo.updatePackage(packageId, {
        packageName: updates.title || updates.packageName,
        description: updates.description,
        destination: updates.destination,
        isActive: updates.status === 'active' || updates.isActive,
        availableDates: updates.availableDates,
        ...updates,
      });

      if (!updated) {
        return sendError(c, 'Failed to update package', 500);
      }

      console.log(`✅ Holiday package updated: ${packageId}`);

      return sendSuccess(c, { package: updated, message: 'Package updated successfully' });

    } catch (error) {
      console.error('❌ Error updating package:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-bookings
   * Get vendor's holiday bookings
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-bookings`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, date } = c.req.query();

      // ✅ SQL: Get vendor bookings
      const holidayRepo = getHolidayPackagesRepository();
      let bookings = await holidayRepo.getVendorBookings(vendorId);

      // Filter by status if provided
      if (status) {
        bookings = bookings.filter((b: any) => b.status === status);
      }

      // Filter by date if provided
      if (date) {
        bookings = bookings.filter((b: any) => b.selectedStartDate.startsWith(date));
      }

      return sendSuccess(c, { bookings, total: bookings.length });

    } catch (error) {
      console.error('❌ Error loading vendor bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/holiday-bookings/:bookingId/status
   * Update booking status
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/holiday-bookings/:bookingId/status`, async (c) => {
    try {
      const { vendorId, bookingId } = c.req.param();
      const { status, paymentStatus } = await c.req.json();

      // ✅ SQL: Get booking
      const holidayRepo = getHolidayPackagesRepository();
      const booking = await holidayRepo.getBookingById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
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

      console.log(`✅ Holiday booking updated: ${bookingId}`);

      return sendSuccess(c, { booking: updated, message: 'Booking updated successfully' });

    } catch (error) {
      console.error('❌ Error updating booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-analytics
   * Get holiday package analytics
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-analytics`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get packages and bookings
      const holidayRepo = getHolidayPackagesRepository();
      const packages = await holidayRepo.getAllPackages({ vendorId });
      const bookings = await holidayRepo.getVendorBookings(vendorId);

      const analytics = {
        totalPackages: packages.length,
        activePackages: packages.filter((p: any) => p.isActive).length,
        totalBookings: bookings.length,
        upcomingTrips: bookings.filter((b: any) => 
          b.status === 'confirmed' && new Date(b.selectedStartDate) > new Date()
        ).length,
        completedTrips: bookings.filter((b: any) => b.status === 'completed').length,
        totalRevenue: bookings
          .filter((b: any) => b.status === 'completed' && b.paymentStatus === 'paid')
          .reduce((sum: number, b: any) => sum + (b.pricing?.totalAmount || 0), 0),
        averageRating: packages.length > 0
          ? packages.reduce((sum: number, p: any) => sum + (p.rating || 0), 0) / packages.length
          : 0,
        popularDestinations: {} as Record<string, number>
      };

      // Track popular destinations
      for (const booking of bookings) {
        const pkg = packages.find((p: any) => p.packageId === booking.packageId);
        if (pkg?.destination) {
          analytics.popularDestinations[pkg.destination] = 
            (analytics.popularDestinations[pkg.destination] || 0) + 1;
        }
      }

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Holiday Package Endpoints (SQL) registered');
}

